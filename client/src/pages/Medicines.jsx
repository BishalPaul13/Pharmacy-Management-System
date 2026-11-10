import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Filter,
  Pill,
  AlertTriangle,
  Eye,
  CheckCircle,
  AlertCircle,
  Boxes,
} from 'lucide-react';
import { api } from '../utils/api';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { formatCurrency, getExpiryBadgeInfo } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

export function Medicines() {
  const { hasRole } = useAuth();
  const [medicines, setMedicines] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState(null);

  // New medicine form state
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    generic_name: '',
    category_id: '',
    dosage_form: 'Tablet',
    strength: '',
    unit_of_measure: 'Strip of 10',
    reorder_level: 20,
    prescription_required: false,
    shelf_location: 'Rack A-1',
    description: '',
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadMedicines();
  }, [search, selectedCategory, lowStockOnly]);

  async function loadCategories() {
    try {
      const res = await api.get('/categories');
      setCategories(res.data);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }

  async function loadMedicines() {
    try {
      setLoading(true);
      let query = `?search=${encodeURIComponent(search)}`;
      if (selectedCategory) query += `&categoryId=${selectedCategory}`;
      if (lowStockOnly) query += `&lowStock=true`;

      const res = await api.get(`/medicines${query}`);
      setMedicines(res.data);
    } catch (err) {
      console.error('Failed to load medicines:', err);
    } finally {
      setLoading(false);
    }
  }

  async function viewMedicineDetails(id) {
    try {
      const res = await api.get(`/medicines/${id}`);
      setSelectedMedicine(res.data);
    } catch (err) {
      alert('Failed to load medicine batches: ' + err.message);
    }
  }

  async function handleCreateMedicine(e) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      await api.post('/medicines', {
        ...formData,
        category_id: parseInt(formData.category_id, 10),
        reorder_level: parseInt(formData.reorder_level, 10),
      });
      setIsAddModalOpen(false);
      // Reset form
      setFormData({
        sku: '',
        name: '',
        generic_name: '',
        category_id: '',
        dosage_form: 'Tablet',
        strength: '',
        unit_of_measure: 'Strip of 10',
        reorder_level: 20,
        prescription_required: false,
        shelf_location: 'Rack A-1',
        description: '',
      });
      loadMedicines();
    } catch (err) {
      setFormError(err.message || 'Failed to create medicine');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Pill className="w-6 h-6 text-emerald-600" />
            <span>Medicine & Product Catalogue</span>
          </h2>
          <p className="text-xs text-slate-500">
            Manage pharmaceutical formulas, reorder alert thresholds, and multi-batch inventory
          </p>
        </div>

        {hasRole('ADMIN', 'PHARMACIST') && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Medicine</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by brand name, generic salt, SKU..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="md:col-span-4">
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 text-slate-700"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3 flex items-center">
          <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={e => setLowStockOnly(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
            <span>Show Low Stock Only (≤ Reorder Level)</span>
          </label>
        </div>
      </div>

      {/* Medicines Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">SKU / Code</th>
                <th className="py-3 px-4">Medicine & Generic Details</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Dosage / Form</th>
                <th className="py-3 px-4 text-center">Active Batches</th>
                <th className="py-3 px-4 text-center">Stock Level</th>
                <th className="py-3 px-4 text-center">Stock Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">Loading medicines catalogue...</td>
                </tr>
              ) : medicines.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">No medicines found matching the active filters.</td>
                </tr>
              ) : (
                medicines.map(med => {
                  const isLow = med.total_active_stock <= med.reorder_level && med.total_active_stock > 0;
                  const isOut = med.total_active_stock <= 0;

                  return (
                    <tr key={med.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-mono font-medium text-slate-600">{med.sku}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm">{med.name}</div>
                        <div className="text-slate-500 text-[11px]">{med.generic_name}</div>
                        {med.shelf_location && (
                          <div className="text-slate-400 text-[10px] mt-0.5">Location: {med.shelf_location}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{med.category_name}</td>
                      <td className="py-3 px-4 text-slate-600">
                        <div>{med.dosage_form}</div>
                        <div className="text-slate-400 text-[10px]">{med.strength} • {med.unit_of_measure}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 border text-slate-700">
                          {med.total_batches} batch{med.total_batches === 1 ? '' : 'es'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-slate-900 text-sm">{med.total_active_stock}</span>
                        <div className="text-[10px] text-slate-400">Min Alert: {med.reorder_level}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isOut ? (
                          <Badge variant="danger">Out of Stock</Badge>
                        ) : isLow ? (
                          <Badge variant="warning">Low Stock</Badge>
                        ) : (
                          <Badge variant="success">In Stock</Badge>
                        )}
                        {med.prescription_required === 1 && (
                          <div className="mt-1">
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                              Rx ONLY
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => viewMedicineDetails(med.id)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition border border-slate-200"
                        >
                          <Boxes className="w-3.5 h-3.5" />
                          <span>View Batches</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Batch Breakdown Modal for Selected Medicine */}
      <Modal
        isOpen={!!selectedMedicine}
        onClose={() => setSelectedMedicine(null)}
        title={`Batch Inventory: ${selectedMedicine?.name} (${selectedMedicine?.sku})`}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500">Generic Name:</span>
              <p className="font-semibold text-slate-800">{selectedMedicine?.generic_name}</p>
            </div>
            <div>
              <span className="text-slate-500">Total Valid Stock:</span>
              <p className="font-semibold text-emerald-700 text-sm">{selectedMedicine?.total_active_stock} units</p>
            </div>
            <div>
              <span className="text-slate-500">Reorder Threshold:</span>
              <p className="font-semibold text-slate-800">{selectedMedicine?.reorder_level} units</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                  <th className="py-2 px-3">Batch Number</th>
                  <th className="py-2 px-3">Manufacturing</th>
                  <th className="py-2 px-3">Expiry Date</th>
                  <th className="py-2 px-3 text-center">Remaining Stock</th>
                  <th className="py-2 px-3 text-right">Cost Price</th>
                  <th className="py-2 px-3 text-right">Sale Price</th>
                  <th className="py-2 px-3 text-center">Shelf Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedMedicine?.batches?.map(b => {
                  const badge = getExpiryBadgeInfo(b.expiry_date, b.status);
                  return (
                    <tr key={b.id}>
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-800">{b.batch_number}</td>
                      <td className="py-2.5 px-3 text-slate-600">{b.manufacturing_date}</td>
                      <td className="py-2.5 px-3 text-slate-800 font-semibold">{b.expiry_date}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-900">{b.quantity}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{formatCurrency(b.cost_price)}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-800">{formatCurrency(b.sale_price)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-medium border text-[11px] ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* Add New Medicine Modal (ADMIN, PHARMACIST) */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Medicine to Catalogue"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateMedicine} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">SKU / Barcode ID *</label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                placeholder="MED-XYZ-100"
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category *</label>
              <select
                required
                value={formData.category_id}
                onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Select Category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Medicine Brand Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Amoxicillin 500mg"
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Generic / Active Salt *</label>
              <input
                type="text"
                required
                value={formData.generic_name}
                onChange={e => setFormData({ ...formData, generic_name: e.target.value })}
                placeholder="e.g. Amoxicillin Trihydrate"
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Dosage Form</label>
              <select
                value={formData.dosage_form}
                onChange={e => setFormData({ ...formData, dosage_form: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
              >
                <option>Tablet</option>
                <option>Capsule</option>
                <option>Syrup</option>
                <option>Injection</option>
                <option>Inhaler</option>
                <option>Drops</option>
                <option>Ointment</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Strength</label>
              <input
                type="text"
                required
                value={formData.strength}
                onChange={e => setFormData({ ...formData, strength: e.target.value })}
                placeholder="500mg / 100mcg"
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Unit of Measure</label>
              <input
                type="text"
                value={formData.unit_of_measure}
                onChange={e => setFormData({ ...formData, unit_of_measure: e.target.value })}
                placeholder="Strip of 10 / Bottle"
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Reorder Alert Level</label>
              <input
                type="number"
                min="0"
                value={formData.reorder_level}
                onChange={e => setFormData({ ...formData, reorder_level: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Shelf / Rack Storage</label>
              <input
                type="text"
                value={formData.shelf_location}
                onChange={e => setFormData({ ...formData, shelf_location: e.target.value })}
                placeholder="Rack B-04 / Cold Storage"
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.prescription_required}
                onChange={e => setFormData({ ...formData, prescription_required: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="font-semibold">Prescription strictly required for dispensing (Rx Flag)</span>
            </label>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description / Safety Notes</label>
            <textarea
              rows="2"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Fictional product for demonstration purposes. Not medical advice."
              className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 border rounded-xl text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Add Medicine'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

