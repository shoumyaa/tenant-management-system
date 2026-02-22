const express   = require('express');
const router    = express.Router();
const Rent      = require('../models/Rent');
const Complaint = require('../models/Complaint');
const { protect, tenantOnly } = require('../middleware/auth');

router.use(protect, tenantOnly);

// GET /api/tenant/rents
router.get('/rents', async (req, res) => {
  try {
    const rents = await Rent.find({ tenant: req.user._id }).sort({ month: -1 });
    res.json({ success: true, count: rents.length, rents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/tenant/rents/current
router.get('/rents/current', async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const rent = await Rent.findOne({ tenant: req.user._id, month: currentMonth });
    res.json({ success: true, rent: rent || null, currentMonth });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/tenant/complaints
router.get('/complaints', async (req, res) => {
  try {
    const complaints = await Complaint.find({ tenant: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, count: complaints.length, complaints });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/tenant/complaints
router.post('/complaints', async (req, res) => {
  try {
    const { category, subject, description, priority } = req.body;
    if (!category || !subject || !description)
      return res.status(400).json({ success: false, message: 'Category, subject and description are required' });

    const complaint = await Complaint.create({
      tenant: req.user._id, category, subject, description,
      priority: priority || 'Medium'
    });

    res.status(201).json({ success: true, message: 'Complaint submitted', complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/tenant/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [currentRent, allRents, complaints] = await Promise.all([
      Rent.findOne({ tenant: req.user._id, month: currentMonth }),
      Rent.find({ tenant: req.user._id }),
      Complaint.find({ tenant: req.user._id })
    ]);

    const totalPaid = allRents.filter(r => r.status === 'Paid').reduce((s, r) => s + r.totalAmount, 0);

    res.json({
      success: true,
      dashboard: {
        tenant:          req.user,
        currentMonth,    currentRent,
        totalPaid,
        totalRentRecords: allRents.length,
        paidCount:        allRents.filter(r => r.status === 'Paid').length,
        unpaidCount:      allRents.filter(r => r.status === 'Unpaid').length,
        totalComplaints:  complaints.length,
        pendingComplaints:complaints.filter(c => c.status === 'Pending').length,
        resolvedComplaints:complaints.filter(c => c.status === 'Resolved').length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
