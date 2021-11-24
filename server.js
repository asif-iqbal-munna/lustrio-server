const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;
const port = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Database URI with environment variable of username & password
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bauja.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

//  Create mongo client
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const run = async () => {
  try {
    await client.connect();
    const database = client.db("lustrioData");
    const hotelsCollection = database.collection("hotels");
    const bookingsCollection = database.collection("bookings");
    const feedbacksCollection = database.collection("feedbacks");

    // Getting all hotels data
    app.get("/hotels", async (req, res) => {
      const hotels = await hotelsCollection.find({}).toArray();
      res.send(hotels);
    });

    // Getting a single hotel data with id parameter
    app.get("/hotel/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const singleHotel = await hotelsCollection.findOne(query);
      res.send(singleHotel);
    });

    // Posting bookings data
    app.post("/bookings", async (req, res) => {
      const bookingInfo = req.body;
      const setBooking = await bookingsCollection.insertOne(bookingInfo);
      res.send(setBooking);
    });

    // Get Bookings data
    app.get("/bookings", async (req, res) => {
      const bookings = await bookingsCollection.find({}).toArray();
      res.send(bookings);
    });

    // Getting a feedback
    app.post("/feedbacks", async (req, res) => {
      const feedbackData = req.body;
      const setFeedback = await feedbacksCollection.insertOne(feedbackData);
      res.send(setFeedback);
    });

    // Get all feedbacks data
    app.get("/feedbacks", async (req, res) => {
      const feedbacks = await feedbacksCollection.find({}).toArray();
      res.send(feedbacks);
    });
  } finally {
    // await client.close();
  }
};

run().catch(console.dir);

app.get("/", (req, res) => {
  console.log("from server");
  res.send("from server");
});

app.listen(port, () => {
  console.log(`listening to the port ${port}`);
});
