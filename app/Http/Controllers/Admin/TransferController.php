<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Transfer;
use App\Services\TransferService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * TRANSFERENCIAS entre sucursales.
 * Permisos: transferencias.ver · transferencias.crear (enviar) · transferencias.recibir · transferencias.anular
 */
class TransferController extends Controller
{
    public function __construct(private TransferService $transfers) {}

    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'status', 'per_page']);
        $allowed = $request->user()->allowedBranchIds();

        $transfers = Transfer::with('fromBranch:id,name', 'toBranch:id,name')
            ->withCount('items')
            ->withSum('items as units', 'quantity')
            // Se ven las que salen de o llegan a mis sucursales
            ->where(fn (Builder $q) => $q->whereIn('from_branch_id', $allowed)->orWhereIn('to_branch_id', $allowed))
            ->when($filters['search'] ?? null, fn (Builder $q, $s) => $q->where('number', 'like', "%{$s}%"))
            ->when($filters['status'] ?? null, fn (Builder $q, $s) => $q->where('status', $s))
            ->latest('id')
            ->paginate($this->perPage($request))
            ->withQueryString();

        return Inertia::render('admin/transfers/index', ['transfers' => $transfers, 'filters' => $filters]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('admin/transfers/create', [
            'fromBranches' => Branch::whereIn('id', $request->user()->allowedBranchIds())->orderBy('name')->get(['id', 'name']),
            'toBranches' => Branch::where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'from_branch_id' => ['required', Rule::in($request->user()->allowedBranchIds())],
            'to_branch_id' => ['required', 'different:from_branch_id', Rule::exists('branches', 'id')->where('is_active', true)->whereNull('deleted_at')],
            'note' => ['nullable', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.batch_id' => ['required', 'integer', 'distinct'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ], [], ['from_branch_id' => 'sucursal de origen', 'to_branch_id' => 'sucursal de destino', 'items' => 'productos', 'items.*.quantity' => 'cantidad']);

        $transfer = $this->transfers->send((int) $data['from_branch_id'], (int) $data['to_branch_id'], $data['items'], $data['note'] ?? null);

        return to_route('admin.transfers.show', $transfer)->with('success', "Transferencia {$transfer->number} enviada.");
    }

    public function show(Request $request, Transfer $transfer): Response
    {
        $allowed = $request->user()->allowedBranchIds();
        abort_unless(in_array($transfer->from_branch_id, $allowed) || in_array($transfer->to_branch_id, $allowed), 403);

        return Inertia::render('admin/transfers/show', [
            'transfer' => $transfer->load([
                'fromBranch:id,name', 'toBranch:id,name', 'registeredBy:id,name', 'receivedBy:id,name', 'cancelledBy:id,name',
                'items.product:id,name,concentration,pharmaceutical_form,base_unit',
            ]),
            'canReceive' => $transfer->status === 'enviada' && in_array($transfer->to_branch_id, $allowed),
            'canCancel' => $transfer->status === 'enviada' && in_array($transfer->from_branch_id, $allowed),
        ]);
    }

    public function receive(Request $request, Transfer $transfer): RedirectResponse
    {
        abort_unless(in_array($transfer->to_branch_id, $request->user()->allowedBranchIds()), 403);

        $this->transfers->receive($transfer, $request->user());

        return back()->with('success', "Transferencia {$transfer->number} recibida. El stock ya está en la sucursal.");
    }

    public function cancel(Request $request, Transfer $transfer): RedirectResponse
    {
        abort_unless(in_array($transfer->from_branch_id, $request->user()->allowedBranchIds()), 403);
        $data = $request->validate(['reason' => ['required', 'string', 'max:255']], [], ['reason' => 'motivo']);

        $this->transfers->cancel($transfer, $data['reason'], $request->user());

        return back()->with('success', "Transferencia {$transfer->number} anulada. El stock volvió al origen.");
    }
}
