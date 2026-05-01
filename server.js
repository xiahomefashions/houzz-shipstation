require("dotenv").config();

const express = require("express");
const axios = require("axios");
const basicAuth = require("basic-auth");
const { parseStringPromise } = require("xml2js");

const app = express();

app.use(express.urlencoded({ extended: true }));

// 🔐 ShipStation login check
function checkAuth(req, res, next) {
  const user = basicAuth(req);

  if (
    !user ||
    user.name !== process.env.SHIPSTATION_USERNAME ||
    user.pass !== process.env.SHIPSTATION_PASSWORD
  ) {
    res.set("WWW-Authenticate", 'Basic realm="ShipStation"');
    return res.status(401).send("Auth required");
  }

  next();
}

// 🔑 Get Houzz token
async function getToken() {
  const res = await axios.post(
    "https://vendor.shophouzz.com/AUTHENTICATE",
    new URLSearchParams({
      CMD: "doAPIAuthenticate",
      apiClientKey: process.env.HOUZZ_API_CLIENT_KEY,
      apiClientSecret: process.env.HOUZZ_API_CLIENT_SECRET
    })
  );

  console.log("AUTH RESPONSE:", res.data);
  return res.data.bearer || res.data.sessionToken;
}

// 📦 Get Houzz orders
async function getOrders() {
  const token = await getToken();

  const res = await axios.post(
    "https://vendor.shophouzz.com/API?format=xml&CMD=getOrdersExt",
    new URLSearchParams({
      CMD: "getOrdersExt",
      id_vendor_ob: process.env.HOUZZ_VENDOR_ID,
      Start: "0",
      NumberOfItems: "10"
    }),
    {
      headers: {
        bearer: token
      }
    }
  );

  const data = await parseStringPromise(res.data, {
    explicitArray: false
  });

  return data;
}

// 🧾 Convert to simple XML
function buildXML(data) {
  const orders =
    data?.GetOrdersResponse?.Orders?.OrderList?.Order || [];

  const list = Array.isArray(orders) ? orders : [orders];

  let xml = `<Orders>`;

  for (let o of list) {
    xml += `
<Order>
  <OrderNumber>${o.InternalOrderNumber}</OrderNumber>
  <OrderStatus>paid</OrderStatus>
</Order>`;
  }

  xml += `</Orders>`;

  return xml;
}

// 🚀 ShipStation GET
app.get("/shipstation/houzz", checkAuth, async (req, res) => {
  try {
    const data = await getOrders();
    const xml = buildXML(data);

    res.set("Content-Type", "application/xml");
    res.send(xml);
  } catch (err) {
    console.log(err.message);
    res.send("error");
  }
});

// test
app.get("/", (req, res) => {
  res.send("Houzz connected ✅");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});