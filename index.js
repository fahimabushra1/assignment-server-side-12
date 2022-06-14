const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
require('dotenv').config();


const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.stdhw.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        // console.log('decoded', decoded)
        req.decoded = decoded;
        next();
    });
}


async function run() {
    try {
        await client.connect();
        const productCollection = client.db('highWay').collection('product');
        const userCollection = client.db('highWay').collection('users');
        const orderCollection = client.db('highWay').collection('orders');
        const reviewCollection = client.db('highWay').collection('myreview');
        const paymentCollection = client.db('highWay').collection('payments');
        const myProfileCollection = client.db('highWay').collection('myprofile');



        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }
        }



        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const product = req.body;
            console.log(product)
            const price = product.price;
            console.log('price', price)
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });





        app.get('/product', async (req, res) => {
            const query = {}
            const cursor = productCollection.find(query)
            const products = await cursor.toArray()
            res.send(products)
        });


        app.get('/product/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const query = { _id: ObjectId(id) };
            // console.log(query);
            const product = await productCollection.findOne(query)
            res.send(product);
        })


        app.post('/product', async (req, res) => {
            const newProduct = req.body;
            // console.log(newProduct)
            const result = await productCollection.insertOne(newProduct);
            res.send(result);
        });


        app.delete('/product/:id', async (req, res) => {
            const id = req.params.id;
            console.log('id', id)
            const query = { _id: ObjectId(id) };
            console.log(query)
            const result = await productCollection.deleteOne(query);
            res.send(result);
        });



        app.get('/user', async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });


        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })


        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            // console.log(email)
            const user = req.body;
            // console.log(user)
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
            res.send({ result, token });
        });



        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })



        app.get('/order', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const query = { email: email };
                const orders = await orderCollection.find(query).toArray();
                return res.send(orders);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' });
            }
        });


        app.get('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await orderCollection.findOne(query);
            res.send(order);
        })




        app.post('/order', async (req, res) => {
            const orders = req.body;
            const result = await orderCollection.insertOne(orders);
            res.send(result);
        });


        app.patch('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            console.log('id', id)
            const payment = req.body;
            console.log('payment', payment)
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }

            const result = await paymentCollection.insertOne(payment);
            const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
            res.send(updatedOrder);
        })


        app.get('/myreview', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const email = req.query.email;
            // console.log(email)
            if (email === decodedEmail) {
                const query = { email: email };
                const cursor = reviewCollection.find(query);
                const addedReviews = await cursor.toArray();
                res.send(addedReviews);
            }
            else {
                res.status(403).send({ message: 'forbidden access' })
            }
        })



        app.post('/myreview', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        })

        app.post('/myprofile', async (req, res) => {
            const profiles = req.body;
            const result = await myProfileCollection.insertOne(profiles);
            res.send(result);
        });

    }


    finally {

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Running');
});
app.listen(port, () => {
    console.log('Listening to port', port);
})
