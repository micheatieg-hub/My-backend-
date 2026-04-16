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
  password: String
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

// ================= ROUTES =================

// TEST
app.get("/", (req, res) => {
  res.send("Backend working ✅");
});

// ================= AUTH =================

// SIGNUP
app.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.json({ message: "Email and password required" });
    }

    const exists = await User.findOne({ email });

    if (exists) {
      return res.json({ message: "Account already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    await User.create({ email, password: hashed });

    res.json({ message: "Account created successfully" });

  } catch {
    res.status(500).json({ message: "Signup error" });
  }
});

// LOGIN
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.json({ message: "Account does not exist" });
    }

    const ok = await bcrypt.compare(password, user.password);

    if (!ok) {
      return res.json({ message: "Incorrect password" });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET
    );

    res.json({
      message: "Login successful",
      token
    });

  } catch {
    res.status(500).json({ message: "Login error" });
  }
});

// FORGOT PASSWORD
app.post("/forgot-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.json({ message: "Account does not exist" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    res.json({ message: "Password updated" });

  } catch {
    res.status(500).json({ message: "Error updating password" });
  }
});

// ================= STORE =================

// CREATE STORE
app.post("/create-store", auth, async (req, res) => {
  try {
    const existing = await Store.findOne({ userId: req.user.id });

    if (existing) {
      return res.json({ message: "Store already exists" });
    }

    const store = await Store.create({
      userId: req.user.id,
      name: req.body.name
    });

    res.json({ message: "Store created successfully", store });

  } catch {
    res.status(500).json({ message: "Error creating store" });
  }
});

// GET STORE
app.get("/my-store", auth, async (req, res) => {
  try {
    const store = await Store.findOne({ userId: req.user.id });
    res.json(store);

  } catch {
    res.status(500).json({ message: "Error fetching store" });
  }
});

// ================= PRODUCTS =================

// ADD PRODUCT
app.post("/products", auth, async (req, res) => {
  try {
    const { name, price } = req.body;

    const product = await Product.create({
      userId: req.user.id,
      name,
      price
    });

    res.json({ message: "Product added", product });

  } catch {
    res.status(500).json({ message: "Error adding product" });
  }
});

// GET PRODUCTS BY USER
app.get("/products/:userId", async (req, res) => {
  try {
    const products = await Product.find({ userId: req.params.userId });
    res.json(products);

  } catch {
    res.status(500).json({ message: "Error fetching products" });
  }
});

// ================= BUY =================

app.post("/buy", auth, async (req, res) => {
  try {
    await Order.create({
      userId: req.user.id,
      items: req.body.items,
      total: req.body.total
    });

    res.json({ message: "Order placed successfully" });

  } catch {
    res.status(500).json({ message: "Order error" });
  }
});

// ================= SERVER =================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});