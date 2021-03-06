const express = require("express");
const app = express();
const cors = require("cors");
const fileUpload = require("express-fileupload");
require("dotenv").config();
const { MongoClient } = require("mongodb");
const admin = require("firebase-admin");
const ObjectId = require("mongodb").ObjectId;
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const port = process.env.PORT || 8000;

const serviceAccount = require("./lustrio-firebase-adminsdk-hpzu3.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload());

// Database URI with environment variable of username & password
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bauja.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

//  Create mongo client
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

//  Middleware to verify before making admin
const verifyToken = async (req, res, next) => {
  if (req.headers?.authorization?.startsWith("Bearer")) {
    const token = req.headers.authorization.split(" ")[1];
    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
};

const run = async () => {
  try {
    await client.connect();
    const database = client.db("lustrioData");
    const hotelsCollection = database.collection("hotels");
    const bookingsCollection = database.collection("bookings");
    const feedbacksCollection = database.collection("feedbacks");
    const usersCollection = database.collection("users");

    // Getting all hotels data
    app.get("/hotels", async (req, res) => {
      const hotels = await hotelsCollection.find({}).toArray();
      res.send(hotels);
    });

    // Add A Hotel
    app.post("/hotels", async (req, res) => {
      const name = req.body.name;
      const price = req.body.price;
      const location = req.body.location;
      const description = req.body.description;
      const image = req.files.image.data;
      const encodedImg = image.toString("base64");
      const imageBuffer = Buffer(encodedImg, "base64");
      const hotelData = {
        name,
        price,
        location,
        description,
        img: imageBuffer,
      };
      const addedHotel = await hotelsCollection.insertOne(hotelData);
      res.send(addedHotel);
    });

    // Delete A Hotel
    app.delete("/hotels/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const deletedHotel = await hotelsCollection.deleteOne(query);
      res.send(deletedHotel);
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

    // Get Bookings by email
    app.get("/bookings/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const userBookings = await bookingsCollection.find(query).toArray();
      res.send(userBookings);
    });

    // Cencel A Booking
    app.delete("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const deletedBooking = await bookingsCollection.deleteOne(query);
      res.send(deletedBooking);
    });

    // Get A Single Booking
    app.get("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const booking = await bookingsCollection.findOne(query);
      res.send(booking);
    });

    // Add registered users
    app.post("/users", async (req, res) => {
      const user = req.body;
      const setUser = await usersCollection.insertOne(user);
      res.send(setUser);
    });

    // Add Google sign in users
    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const setUser = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(setUser);
    });

    // Make Admin
    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = {
            $set: { role: "admin" },
          };
          const makeAdmin = await usersCollection.updateOne(filter, updateDoc);
          res.send(makeAdmin);
        }
      }
      res.status(403);
    });

    //  check if Admin
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.send({ admin: isAdmin });
    });

    // Create a PaymentIntent with the order amount and currency
    app.post("/create-payment-intent", async (req, res) => {
      const paymentInfo = req.body;
      // const price = parseInt(paymentInfo.price);
      const amount = paymentInfo.price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });

      // updating booking for the payment status
      app.put("/booking/:id", async (req, res) => {
        const id = req.params.id;
        const filter = { _id: ObjectId(id) };
        const updateDoc = {
          $set: { paid: true, status: "approved" },
        };
        const paidBooking = await bookingsCollection.updateOne(
          filter,
          updateDoc
        );
        res.send(paidBooking);
      });
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
