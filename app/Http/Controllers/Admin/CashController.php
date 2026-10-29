<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CashMovement;
use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Denomination;
use App\Services\CashService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * CAJA con corte de billetes.
 * Permisos: caja.ver (mi caja e historial propio) · caja.operar (abrir, movimientos, cerrar)
 *           caja.aprobar (ver todos los turnos y aprobar diferencias) · caja.editar (cajas y billetes)
 */
class CashController extends Controller
{
    public function __construct(private CashService $cash) {}

    /** GET /admin/cash — mi turno: formulario de apertura, o resumen + movimientos + cierre. */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $session = $this->cash->currentSession($user)?->load('cashRegister:id,name', 'branch:id,name', 'movements');

        return Inertia::render('admin/cash/index', [
            'session' => $session,
            'summary' => $session ? $this->cash->summary($session) : null,
            'registers' => $session ? [] : CashRegister::with('branch:id,name')
                ->where('is_active', true)
                ->whereIn('branch_id', $user->allowedBranchIds())
                ->whereDoesntHave('sessions', fn (Builder $q) => $q->where('status', CashSession::OPEN))
                ->orderBy('name')
                ->get(['id', 'name', 'branch_id']),
            'denominations' => Denomination::where('is_active', true)->orderByDesc('value')->get(['id', 'value', 'type']),
            'movementTypes' => CashMovement::TYPES,
            'paymentMethods' => config('farmacia.payment_methods'),
            'lastClosed' => $session ? null : CashSession::where('user_id', $user->id)->whereNotNull('closed_at')->latest('closed_at')->first(),
        ]);
    }

    public function open(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'cash_register_id' => ['required', Rule::exists('cash_registers', 'id')->whereNull('deleted_at')],
            'counts' => ['present', 'array'],
            'counts.*' => ['integer', 'min:0'],
        ], [], ['cash_register_id' => 'caja']);

        $session = $this->cash->open(CashRegister::findOrFail($data['cash_register_id']), $request->user(), $data['counts']);

        return back()->with('success', 'Caja abierta con '.number_format((float) $session->opening_amount, 2).' de fondo inicial.');
    }

    public function movement(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(CashMovement::TYPES))],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'reason' => ['required', 'string', 'max:255'],
        ], [], ['amount' => 'monto', 'reason' => 'motivo']);

        $session = $this->currentOrFail($request);
        $this->cash->addMovement($session, $data['type'], (float) $data['amount'], $data['reason']);

        return back()->with('success', CashMovement::TYPES[$data['type']].' registrado.');
    }

    public function close(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'counts' => ['present', 'array'],
            'counts.*' => ['integer', 'min:0'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $session = $this->cash->close($this->currentOrFail($request), $data['counts'], $data['note'] ?? null);

        return to_route('admin.cash.sessions.show', $session)->with(
            $session->status === CashSession::PENDING ? 'error' : 'success',
            $session->status === CashSession::PENDING
                ? 'Caja cerrada con diferencia de '.number_format((float) $session->difference, 2).'. Queda pendiente de revisión.'
                : 'Caja cerrada correctamente.',
        );
    }

    /** GET /admin/cash/sessions — historial de turnos (los propios; con caja.aprobar, todos). */
    public function sessions(Request $request): Response
    {
        $user = $request->user();
        $filters = $request->only(['status', 'per_page']);

        $sessions = CashSession::with('cashRegister:id,name', 'branch:id,name', 'user:id,name')
            ->when(! $user->can('caja.aprobar'), fn (Builder $q) => $q->where('user_id', $user->id))
            ->when($user->can('caja.aprobar'), fn (Builder $q) => $q->whereIn('branch_id', $user->allowedBranchIds()))
            ->when($filters['status'] ?? null, fn (Builder $q, $s) => $q->where('status', $s))
            ->latest('opened_at')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return Inertia::render('admin/cash/sessions', ['sessions' => $sessions, 'filters' => $filters]);
    }

    /** GET /admin/cash/sessions/{session} — detalle: corte de billetes, movimientos y ventas. */
    public function show(Request $request, CashSession $session): Response
    {
        $this->authorizeView($request, $session);

        return Inertia::render('admin/cash/show', [
            'session' => $session->load('cashRegister:id,name', 'branch:id,name', 'user:id,name', 'reviewedBy:id,name', 'counts', 'movements'),
            'summary' => $this->cash->summary($session),
            'sales' => $session->sales()->with('payments')->latest('id')->get(['id', 'number', 'total', 'status', 'customer_name', 'created_at']),
            'paymentMethods' => config('farmacia.payment_methods'),
            'movementTypes' => CashMovement::TYPES,
            'canApprove' => $session->status === CashSession::PENDING && $request->user()->can('caja.aprobar') && $session->user_id !== $request->user()->id,
        ]);
    }

    public function approve(Request $request, CashSession $session): RedirectResponse
    {
        abort_unless(in_array($session->branch_id, $request->user()->allowedBranchIds()), 403);
        $data = $request->validate(['note' => ['nullable', 'string', 'max:255']]);

        $this->cash->approve($session, $request->user(), $data['note'] ?? null);

        return back()->with('success', 'Cierre de caja aprobado.');
    }

    private function currentOrFail(Request $request): CashSession
    {
        $session = $this->cash->currentSession($request->user());
        abort_unless($session, 404, 'No tienes una caja abierta.');

        return $session;
    }

    private function authorizeView(Request $request, CashSession $session): void
    {
        $user = $request->user();
        $own = $session->user_id === $user->id;
        abort_unless($own || ($user->can('caja.aprobar') && in_array($session->branch_id, $user->allowedBranchIds())), 403);
    }
}
