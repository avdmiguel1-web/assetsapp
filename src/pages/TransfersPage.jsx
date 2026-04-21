import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { useTranslation } from '../hooks/useTranslation';
import { Plus, Search, X, ArrowRight, ArrowDown, Truck } from 'lucide-react';
import NewTransferModal from '../components/modals/NewTransferModal';

export default function TransfersPage() {
  const { state } = useAppContext();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);

  const transfers = state.transfers || [];
  const assets = state.assets || [];
  const warehouses = state.warehouses || [];

  // Helper: get asset by id
  const getAsset = (assetId) =>
    assets.find((a) => a.id === assetId || a.assetId === assetId);

  // Helper: get warehouse by id
  const getWarehouse = (warehouseId) =>
    warehouses.find((w) => w.id === warehouseId);

  // Filtered transfers
  const filteredTransfers = useMemo(() => {
    if (!searchQuery.trim()) return transfers;
    const q = searchQuery.toLowerCase();
    return transfers.filter((tr) => {
      const asset = getAsset(tr.assetId);
      const origin = getWarehouse(tr.originWarehouseId);
      const destination = getWarehouse(tr.destinationWarehouseId);
      return (
        asset?.name?.toLowerCase().includes(q) ||
        asset?.assetId?.toLowerCase().includes(q) ||
        asset?.brand?.toLowerCase().includes(q) ||
        asset?.model?.toLowerCase().includes(q) ||
        origin?.name?.toLowerCase().includes(q) ||
        origin?.country?.toLowerCase().includes(q) ||
        destination?.name?.toLowerCase().includes(q) ||
        destination?.country?.toLowerCase().includes(q)
      );
    });
  }, [transfers, searchQuery, assets, warehouses]);

  const sortedTransfers = useMemo(
    () =>
      [...filteredTransfers].sort(
        (a, b) => new Date(b.transferDate) - new Date(a.transferDate)
      ),
    [filteredTransfers]
  );

  const countryFlag = (code) => {
    if (!code) return '';
    const flags = { VE: '🇻🇪', CO: '🇨🇴', US: '🇺🇸' };
    return flags[code?.toUpperCase()] || '';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white px-4 pt-4 pb-3 border-b border-gray-200 flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-900">{t('transfers.title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {sortedTransfers.length} {t('transfers.registered')}
        </p>

        {/* New Transfer button */}
        <button
          onClick={() => setShowModal(true)}
          className="mt-3 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-2.5 rounded-xl transition-colors"
        >
          <Plus size={18} />
          {t('transfers.newTransfer')}
        </button>

        {/* Search */}
        <div className="mt-3 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder={t('transfers.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-100 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {sortedTransfers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
            <Truck size={36} strokeWidth={1.2} />
            <p className="text-sm">{t('transfers.noTransfers')}</p>
          </div>
        ) : (
          sortedTransfers.map((transfer) => {
            const asset = getAsset(transfer.assetId);
            const origin = getWarehouse(transfer.originWarehouseId);
            const destination = getWarehouse(transfer.destinationWarehouseId);

            return (
              <TransferCard
                key={transfer.id}
                transfer={transfer}
                asset={asset}
                origin={origin}
                destination={destination}
                countryFlag={countryFlag}
                formatDate={formatDate}
                t={t}
              />
            );
          })
        )}
      </div>

      {showModal && <NewTransferModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   TransferCard  –  layout mobile-first:
   fila 1: foto + id activo
   fila 2: ORIGEN  (etiqueta + datos)
   fila 3: ↓ flecha
   fila 4: DESTINO (etiqueta + datos)
───────────────────────────────────────────────────────── */
function TransferCard({ transfer, asset, origin, destination, countryFlag, formatDate, t }) {
  const assetImage = asset?.imageUrl || asset?.photo || null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* ── Fila 1: Foto + ID activo ── */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-gray-100">
        {/* Foto */}
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
          {assetImage ? (
            <img
              src={assetImage}
              alt={asset?.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Truck size={22} className="text-gray-400" />
            </div>
          )}
        </div>

        {/* Nombre + ID */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm leading-tight truncate">
            {asset?.name || t('transfers.unknownAsset')}
          </p>
          {asset?.assetId && (
            <p className="text-xs text-gray-500 mt-0.5">{asset.assetId}</p>
          )}
        </div>

        {/* Fecha */}
        <div className="flex-shrink-0 text-right">
          <p className="text-xs text-gray-400">{formatDate(transfer.transferDate)}</p>
        </div>
      </div>

      {/* ── Filas 2‑3‑4: Origen → Destino vertical ── */}
      <div className="px-4 py-3 flex flex-col gap-0">

        {/* Fila 2: ORIGEN */}
        <LocationBlock
          label={t('transfers.origin')}
          warehouse={origin}
          countryFlag={countryFlag}
          extra={transfer.originExtra}
          variant="neutral"
        />

        {/* Fila 3: Flecha */}
        <div className="flex items-center justify-center py-1.5">
          <div className="flex flex-col items-center">
            <div className="w-px h-3 bg-gray-300" />
            <ArrowDown size={18} className="text-blue-500" strokeWidth={2.5} />
            <div className="w-px h-3 bg-gray-300" />
          </div>
        </div>

        {/* Fila 4: DESTINO */}
        <LocationBlock
          label={t('transfers.destination')}
          warehouse={destination}
          countryFlag={countryFlag}
          extra={transfer.destinationExtra}
          variant="highlight"
        />
      </div>

      {/* ── Footer: notas opcionales ── */}
      {transfer.notes && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-400 italic truncate">{transfer.notes}</p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   LocationBlock  –  muestra etiqueta + país + nombre almacén
───────────────────────────────────────────────────────── */
function LocationBlock({ label, warehouse, countryFlag, extra, variant }) {
  const isHighlight = variant === 'highlight';

  return (
    <div
      className={`rounded-xl px-3 py-2.5 ${
        isHighlight
          ? 'bg-green-50 border border-green-200'
          : 'bg-gray-50 border border-gray-200'
      }`}
    >
      {/* Etiqueta */}
      <p
        className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${
          isHighlight ? 'text-green-600' : 'text-gray-400'
        }`}
      >
        {label}
      </p>

      {warehouse ? (
        <div className="flex items-start gap-2">
          {/* Flag + country code */}
          <span className="text-base leading-tight mt-0.5">
            {countryFlag(warehouse.countryCode || warehouse.country)}
          </span>
          <div>
            <p
              className={`text-xs font-semibold leading-tight ${
                isHighlight ? 'text-green-800' : 'text-gray-700'
              }`}
            >
              {warehouse.name}
            </p>
            {warehouse.city && (
              <p className="text-[11px] text-gray-500 mt-0.5">{warehouse.city}</p>
            )}
            {extra && (
              <p className="text-[11px] text-gray-500 mt-0.5 italic">{extra}</p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">—</p>
      )}
    </div>
  );
}
