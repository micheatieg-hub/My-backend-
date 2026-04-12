const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

let users = [];

// Test
app.get("/", (req, res) => {
  res.send("Backend is working");
});

// Signup
app.post("/signup", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email/password required" });

  if (users.find(u => u.email === email))
    return res.status(400).json({ error: "User exists" });

  users.push({ email, password });
  fs.writeFileSync("users.json", JSON.stringify(users));

  res.json({ message: "Account created" });
});

// Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const user = users.find(
    u => u.email === email && u.password === password
  );

  if (!user)
    return res.status(400).json({ error: "Incorrect email or password" });

  res.json({ message: "Login successful" });
});

// Forgot password
app.post("/forgot-password", (req, res) => {
  const { email, newPassword } = req.body;

  const user = users.find(u => u.email === email);

  if (!user)
    return res.status(400).json({ error: "User not found" });

  user.password = newPassword;
  fs.writeFileSync("users.json", JSON.stringify(users));

  res.json({ message: "Password updated" });
});

// Buy
app.post("/buy", (req, res) => {
  const { packageName, userEmail, message } = req.body;

  const data = {
    packageName,
    userEmail,
    message,
    time: new Date()
  };

  fs.appendFileSync("buys.json", JSON.stringify(data) + "\n");

  res.json({ message: "Order sent to admin" });
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});