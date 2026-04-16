const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

// ================= DATABASE =================
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("DB Error:", err));

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

// ================= ADMIN AUTO CREATE =================
mongoose.connection.once("open", async () => {
  const adminEmail = "tiegmicheal@gmail.com";

  const adminExists = await User.findOne({ email: adminEmail });

  if (!adminExists) {
    const hashed = await bcrypt.hash("admin123", 10);

    await User.create({
      email: adminEmail,
      password: hashed,
      role: "admin"
    });

    console.log("Admin created");
  }
});

// ================= AUTH =================

function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

// ================= ADMIN =================

function adminOnly(req, res, next) {
  const token = req.headers.authorization;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Admins only" });
    }

    req.user = decoded;
    next();

  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
}

// ================= AUTH ROUTES =================

// SIGNUP
app.post("/signup", async (req, res) => {
  const exists = await User.findOne({ email: req.body.email });

  if (exists) {
    return res.json({ message: "Account already exists" });
  }

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

  if (!user) {
    return res.json({ message: "Account does not exist" });
  }

  const ok = await bcrypt.compare(req.body.password, user.password);

  if (!ok) {
    return res.json({ message: "Incorrect password" });
  }

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET
  );

  res.json({
    message: "Login successful",
    token,
    role: user.role
  });
});

// ================= STORE SYSTEM =================

// CREATE STORE
app.post("/create-store", auth, async (req, res) => {
  const existing = await Store.findOne({ userId: req.user.id });

  if (existing) {
    return res.json({ message: "Store already exists", store: existing });
  }

  const store = await Store.create({
    userId: req.user.id,
    name: req.body.name
  });

  res.json({ message: "Store created", store });
});

// GET MY STORE (OWNER)
app.get("/store-owner", auth, async (req, res) => {
  const store = await Store.findOne({ userId: req.user.id });
  res.json(store);
});

// PUBLIC STORE (FOR STORE PAGE)
app.get("/store/:userId", async (req, res) => {
  const store = await Store.findOne({ userId: req.params.userId });

  if (!store) {
    return res.status(404).json({ message: "Store not found" });
  }

  res.json(store);
});

// ================= PRODUCTS =================

// ADD PRODUCT
app.post("/products", auth, async (req, res) => {
  const product = await Product.create({
    userId: req.user.id,
    name: req.body.name,
    price: req.body.price
  });

  res.json({ message: "Product added", product });
});

// GET PRODUCTS (PUBLIC STORE)
app.get("/products/:userId", async (req, res) => {
  const products = await Product.find({ userId: req.params.userId });
  res.json(products);
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

// ================= SERVER =================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});