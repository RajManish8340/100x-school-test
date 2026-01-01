import express from 'express';
import { SignupSchema } from './types';
import { UserModel } from './models';

const app = express();

const port = 3000;
app.listen(port);
console.log(`swerver running at port ${port}`)

app.post('/auth/signup', async (req, res) => {
   const { success, data } = SignupSchema.safeParse(req.body);

   if (!success) {
      res.status(400).json({
         "success": false,
         "error": "Invalid request schema",
      })
   }
   const user = await UserModel.findOne({
      email: data?.email
   })

   if (user) {
      res.status(400).json({
         "success": false,
         "error": "Email already exists"
      })
   }

   const userDb = await UserModel.create({
      name: data?.name,
      email: data?.email,
      password: data?.password,
   })

   res.json({
      success: true,
      data: {
         _id: userDb._id,
         name: userDb.email,
         password: userDb.password,
      }
   })


})

