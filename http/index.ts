import express from 'express';
import { LoginSchema, SignupSchema } from './types';
import { UserModel } from './models';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json())

const port = 3000;
app.listen(port);
console.log(`swerver running at port ${port}`)

app.post('/auth/signup', async (req, res) => {
    const { success, data } = SignupSchema.safeParse(req.body);

    console.log('data:' ,data)
    if (!success) {
        console.log(data)
        res.status(400).json({
            "success": false,
            "error": "Invalid request schema",
        })
        return
    }
    const user = await UserModel.findOne({
        email: data?.email
    })

    if (user) {
        res.status(400).json({
            "success": false,
            "error": "Email already exists"
        })
        return
    }

    const userDb = await UserModel.create({
        name: data?.name,
        email: data?.email,
        password: data?.password,
    })

    res.status(201).json({
        success: true,
        data: {
            _id: userDb._id,
            name: userDb.name,
            email: userDb.email,
            password: userDb.password,
        }
    })

})

app.post('/auth/login', async (req, res) => {
    const {success, data} = LoginSchema.safeParse(req.body);

    if (!success) {
        res.status(400).json({
            "success": false,
            "error": "Invalid request schema",
        })
        return
    }

    const user = await UserModel.findOne({
        email: data?.email,
        password: data?.password,

    })

    if(!user) {
        res.status(404).json({
            'success' : false,
            'error' : "Invalid email or password",
        })
        return
    }
    if(user) {
        const token = jwt.sign({
            "email" : user.email,
        }, "SECRET_KEY", {
            expiresIn: "2h"
        })

        res.json({
            "success": true,
            "data" : {
                "token" : token,
            }
        })
        return

    }

})
