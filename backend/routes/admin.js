const express    = require('express');
const router     = express.Router();
const User       = require('../models/User');
const Rent       = require('../models/Rent');
const Complaint  = require('../models/Complaint');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);

// ── TENANTS ─────────────────────────────────────────────────────

router.get('/tenants', async (req, res) => {
  try {
    const tenants = await User.find({ role: 'tenant' }).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, count: tenants.length, tenants });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/tenants', async (req, res) => {
  try {
    const { name, email, phone, password, unit, baseRent } = req.body;
    if (!name || !email || !phone || !password)
      return res.status(400).json({ success: false, message: 'Name, email, phone and password are required' });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(400).json({ success: false, message: 'Email already registered' });

    const tenant = await User.create({
      name, email: email.toLowerCase(), phone, password,
      unit: unit || '', baseRent: baseRent || 0, role: 'tenant'
    });

    res.status(201).json({
      success: true, message: 'Tenant added successfully',
      tenant: { id: tenant._id, name: tenant.name, email: tenant.email, phone: tenant.phone, unit: tenant.unit, baseRent: tenant.baseRent }
    });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ success: false, message: 'Email already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/tenants/:id', async (req, res) => {
  try {
    const { name, phone, unit, baseRent, isActive } = req.body;
    const tenant = await User.findById(req.params.id);
    if (!tenant || tenant.role !== 'tenant')
      return res.status(404).json({ success: false, message: 'Tenant not found' });

    if (name     !== undefined) tenant.name     = name;
    if (phone    !== undefined) tenant.phone    = phone;
    if (unit     !== undefined) tenant.unit     = unit;
    if (baseRent !== undefined) tenant.baseRent = baseRent;
    if (isActive !== undefined) tenant.isActive = isActive;

    await tenant.save();
    res.json({ success: true, message: 'Tenant updated', tenant });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/tenants/:id', async (req, res) => {
  try {
    const tenant = await User.findById(req.params.id);
    if (!tenant || tenant.role !== 'tenant')
      return res.status(404).json({ success: false, message: 'Tenant not found' });

    await User.findByIdAndDelete(req.params.id);
    await Rent.deleteMany({ tenant: req.params.id });
    await Complaint.deleteMany({ tenant: req.params.id });

    res.json({ success: true, message: 'Tenant deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── RENTS ────────────────────────────────────────────────────────

router.get('/rents', async (req, res) => {
  try {
    const { month, status, tenantId } = req.query;
    const filter = {};
    if (month)    filter.month  = month;
    if (status)   filter.status = status;
    if (tenantId) filter.tenant = tenantId;

    const rents = await Rent.find(filter)
      .populate('tenant', 'name email phone unit')
      .sort({ createdAt: -1 });

    const totalCollection = rents.filter(r => r.status === 'Paid').reduce((s, r) => s + r.totalAmount, 0);
    const totalPending    = rents.filter(r => r.status === 'Unpaid').reduce((s, r) => s + r.totalAmount, 0);

    res.json({ success: true, count: rents.length, totalCollection, totalPending, rents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/rents/generate', async (req, res) => {
  try {
    const { tenantId, month, baseRent, previousUnit, currentUnit } = req.body;
    if (!tenantId || !month)
      return res.status(400).json({ success: false, message: 'Tenant and month are required' });

    const tenant = await User.findById(tenantId);
    if (!tenant || tenant.role !== 'tenant')
      return res.status(404).json({ success: false, message: 'Tenant not found' });

    const existing = await Rent.findOne({ tenant: tenantId, month });
    if (existing)
      return res.status(400).json({ success: false, message: `Rent for ${month} already generated` });

    const rent = await Rent.create({
      tenant:       tenantId,
      month,
      year:         parseInt(month.split('-')[0]),
      baseRent:     parseFloat(baseRent)      || tenant.baseRent || 0,
      previousUnit: parseFloat(previousUnit)  || 0,
      currentUnit:  parseFloat(currentUnit)   || 0,
      ratePerUnit:  10
    });

    await rent.populate('tenant', 'name email phone unit');
    res.status(201).json({ success: true, message: 'Rent generated successfully', rent });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ success: false, message: 'Rent already exists for this tenant and month' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/rents/:id', async (req, res) => {
  try {
    const { previousUnit, currentUnit, status, notes } = req.body;
    const rent = await Rent.findById(req.params.id);
    if (!rent) return res.status(404).json({ success: false, message: 'Rent not found' });

    if (previousUnit !== undefined) rent.previousUnit = parseFloat(previousUnit);
    if (currentUnit  !== undefined) rent.currentUnit  = parseFloat(currentUnit);
    if (status) {
      rent.status   = status;
      rent.paidDate = status === 'Paid' ? new Date() : undefined;
    }
    if (notes !== undefined) rent.notes = notes;

    await rent.save();
    await rent.populate('tenant', 'name email phone unit');
    res.json({ success: true, message: 'Rent updated', rent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/rents/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Paid', 'Unpaid'].includes(status))
      return res.status(400).json({ success: false, message: 'Status must be Paid or Unpaid' });

    const rent = await Rent.findById(req.params.id);
    if (!rent) return res.status(404).json({ success: false, message: 'Rent not found' });

    rent.status   = status;
    rent.paidDate = status === 'Paid' ? new Date() : undefined;
    await rent.save();

    res.json({ success: true, message: `Marked as ${status}`, rent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/rents/:id', async (req, res) => {
  try {
    await Rent.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Rent deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── COMPLAINTS ───────────────────────────────────────────────────

router.get('/complaints', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const complaints = await Complaint.find(filter)
      .populate('tenant', 'name email phone unit')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: complaints.length, complaints });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/complaints/:id', async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

    if (status    !== undefined) complaint.status    = status;
    if (adminNote !== undefined) complaint.adminNote = adminNote;
    if (status === 'Resolved')   complaint.resolvedAt = new Date();

    await complaint.save();
    await complaint.populate('tenant', 'name email phone unit');
    res.json({ success: true, message: 'Complaint updated', complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── STATS ────────────────────────────────────────────────────────

router.get('/stats', async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);

    const [totalTenants, activeTenants, currentMonthRents, allPaidRents, pendingComplaints, totalComplaints] =
      await Promise.all([
        User.countDocuments({ role: 'tenant' }),
        User.countDocuments({ role: 'tenant', isActive: true }),
        Rent.find({ month: currentMonth }).populate('tenant', 'name unit'),
        Rent.find({ status: 'Paid' }),
        Complaint.countDocuments({ status: { $ne: 'Resolved' } }),
        Complaint.countDocuments()
      ]);

    const currentMonthCollection = currentMonthRents.filter(r => r.status === 'Paid').reduce((s, r) => s + r.totalAmount, 0);
    const currentMonthPending    = currentMonthRents.filter(r => r.status === 'Unpaid').reduce((s, r) => s + r.totalAmount, 0);
    const totalCollection        = allPaidRents.reduce((s, r) => s + r.totalAmount, 0);

    res.json({
      success: true,
      stats: {
        totalTenants, activeTenants, currentMonth,
        currentMonthRents:      currentMonthRents.length,
        currentMonthPaidCount:  currentMonthRents.filter(r => r.status === 'Paid').length,
        currentMonthUnpaidCount:currentMonthRents.filter(r => r.status === 'Unpaid').length,
        currentMonthCollection, currentMonthPending,
        totalCollection, pendingComplaints, totalComplaints
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
