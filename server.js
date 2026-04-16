const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

// ================= ENV =================
const PORT = process.env.PORT || 3000;

// ================= DB =================
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("DB Error:", err));

// ================= OPENAI =================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ================= EMAIL =================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "tiegmicheal@gmail.com",
    pass: process.env.EMAIL_PASS
  }
});

// ================= MODELS =================
const User = mongoose.model("User", {
  email: String,
  password: String,
  role: { type: String, default: "user" }
});

const Store = mongoose.model("Store", {
  userId: String,
  name: String
});

const Product = mongoose.model("Product", {
  userId: String,
  name: String,
  price: Number
});

const Order = mongoose.model("Order", {
  userId: String,
  items: Array,
  total: Number
});

// ================= ADMIN AUTO =================
mongoose.connection.once("open", async () => {
  const adminEmail = "tiegmicheal@gmail.com";

  const admin = await User.findOne({ email: adminEmail });

  if (!admin) {
    const hashed = await bcrypt.hash("admin123", 10);

    await User.create({
      email: adminEmail,
      password: hashed,
      role: "admin"
    });

    console.log("Admin created");
  } else {
    admin.role = "admin";
    await admin.save();
  }
});

// ================= AUTH =================
function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

// ================= ADMIN LOCK =================
function adminOnly(req, res, next) {
  const token = req.headers.authorization;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const ADMIN_EMAIL = "tiegmicheal@gmail.com";

    if (decoded.email !== ADMIN_EMAIL || decoded.role !== "admin") {
      return res.status(403).json({ message: "Admins only" });
    }

    req.user = decoded;
    next();

  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
}

// ================= ROOT =================
app.get("/", (req, res) => {
  res.json({ status: "Backend running 🚀" });
});

// ================= AUTH =================

// SIGNUP
app.post("/signup", async (req, res) => {
  const exists = await User.findOne({ email: req.body.email });

  if (exists) return res.json({ message: "Account exists" });

  const hashed = await bcrypt.hash(req.body.password, 10);

  await User.create({
    email: req.body.email,
    password: hashed
  });

  res.json({ message: "Account created" });
});

// LOGIN
app.post("/login", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) return res.json({ message: "Not found" });

  const ok = await bcrypt.compare(req.body.password, user.password);

  if (!ok) return res.json({ message: "Wrong password" });

  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ message: "Login success", token, role: user.role });
});

// ================= FORGOT PASSWORD =================
app.post("/forgot-password", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) return res.json({ message: "User not found" });

  const token = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  const link = `https://your-frontend.com/reset.html?token=${token}`;

  await transporter.sendMail({
    from: "AI SaaS <tiegmicheal@gmail.com>",
    to: user.email,
    subject: "Reset Password",
    html: `<a href="${link}">Reset Password</a>`
  });

  res.json({ message: "Reset email sent" });
});

// ================= RESET PASSWORD =================
app.post("/reset-password", async (req, res) => {
  try {
    const decoded = jwt.verify(req.body.token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    user.password = await bcrypt.hash(req.body.newPassword, 10);

    await user.save();

    res.json({ message: "Password updated" });

  } catch {
    res.status(400).json({ message: "Invalid token" });
  }
});

// ================= STORE =================
app.post("/create-store", auth, async (req, res) => {
  const store = await Store.create({
    userId: req.user.id,
    name: req.body.name
  });

  res.json(store);
});

app.get("/store/:userId", async (req, res) => {
  const store = await Store.findOne({ userId: req.params.userId });
  const products = await Product.find({ userId: req.params.userId });

  res.json({ store, products });
});

// ================= PRODUCTS =================
app.post("/products", auth, async (req, res) => {
  const product = await Product.create({
    userId: req.user.id,
    name: req.body.name,
    price: req.body.price
  });

  res.json(product);
});

// ================= ORDERS =================
app.post("/buy", auth, async (req, res) => {
  await Order.create({
    userId: req.user.id,
    items: req.body.items,
    total: req.body.total
  });

  res.json({ message: "Order placed" });
});

// ================= ADMIN =================
app.get("/admin/orders", adminOnly, async (req, res) => {
  const orders = await Order.find();
  res.json(orders);
});

// ================= AI STORE BUILDER =================
app.post("/ai/create-store", auth, async (req, res) => {
  try {
    const { storeName, niche } = req.body;

    const prompt = `
Create an ecommerce store for niche: ${niche}

Return JSON:
{
  "products":[{"name":"", "price":0}],
  "description":""
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });

    const data = JSON.parse(response.choices[0].message.content);

    const store = await Store.create({
      userId: req.user.id,
      name: storeName
    });

    const products = await Product.insertMany(
      data.products.map(p => ({
        userId: req.user.id,
        name: p.name,
        price: p.price
      }))
    );

    res.json({
      store,
      products,
      description: data.description
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= SERVER =================
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});