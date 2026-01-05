import express from 'express';
import { AddStudentSchema, AttendanceStartSchema, CreateClassSchema, LoginSchema, SignupSchema } from './types';
import { AttendanceModel, ClassModel, UserModel } from './models';
import jwt from 'jsonwebtoken';
import { authMiddleware, teacherMiddleware } from './middleware';
import mongoose from 'mongoose';

const app = express();
app.use(express.json())

const port = 3000;
app.listen(port);
console.log(`seever running at port ${port}`)

app.post('/auth/signup', async (req, res) => {

    const { success, data } = SignupSchema.safeParse(req.body);

    if (!success) {
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

    const userDb = await UserModel.findOne({
        email: data?.email,

    })

    if(!userDb || userDb.password != data.password) {
        res.status(400).json({
            'success' : false,
            'error' : "Invalid email or password",
        })
        return
    }
    const token = jwt.sign({
        role : userDb.role,
        userId: userDb._id,
    }, process.env.JWT_PASSWORD!, )

    res.json({
        "success": true,
        "data" : {
            token
        }
    })
    return


})

app.get('/auth/me', authMiddleware, async (req, res) => {

    const userDb = await UserModel.findOne({
        _id : req.userId,
    })

    if (!userDb) {
        res.status(400).json({
            message: "you cannot reach here "
        })
    }

    res.json({
        "success": true,
        "data": {
            "_id": userDb?._id,
            "name": userDb?.name,
            "email": userDb?.email,
            "role": userDb?.role,
        }
    })
})

app.post('/class', teacherMiddleware, async(req, res) => {

    const { success, data } = CreateClassSchema.safeParse(req.body);

    if(!success) {
        res.status(400).json({
            "success": false,
            "error": "Invalid request schema",
        })
        return
    }

    const classDb = await ClassModel.create({
        className : data.className ,
        teacherId : req.userId,
        studentIds : []
    })

    res.json({
        "success": true,
        "data": {
            "_id": classDb._id,
            "className": classDb.className,
            "teacherId": classDb.teacherId,
            "studentIds": []
        }
    })

})

app.post('/class/:id/add-student' , authMiddleware, teacherMiddleware, async (req, res) => {
    const {success, data} = AddStudentSchema.safeParse(req.body);

    if (!success) {
        res.status(400).json({
            "success": false,
            "error": "Invalid request schema",
        })
        return
    }

    const classDb = await ClassModel.findOne({
        _id : req.params.id
    })

    if(!classDb) {
        res.status(404).json({
          success: false,
          error: "Class not found",
        });
        return
    }
    
    const userDb = await UserModel.findOne({
        _id: data.studentId,
    })

    if(!userDb) {
        res.status(404).json({
          success: false,
          error: "Student not found",
        });
        return
    }

    // TODO: clear this 
    if(classDb.teacherId !== req.userId) {
        res.status(403).json({
          success: false,
          error: "Forbidden, not class teacher",
        });
    }

    // TODO: Understand what is this 
    classDb.studentIds.push(new mongoose.Types.ObjectId(data.studentId))
    await classDb.save()

    res.json({
      success: true,
      data: {
        _id: classDb._id,
        className: classDb.className,
        teacherId:classDb.teacherId,
        studentIds: classDb.studentIds,
      },
    });


})

app.get('/class/:id', authMiddleware, async (req , res) => {
    const classDb = await ClassModel.findOne({
        _id : req.params.id,
    })
    if (!classDb) {
      res.status(404).json({
        success: false,
        error: "Class not found",
      });
      return
    }

    if (
      classDb?.teacherId == req.userId ||
      classDb?.studentIds.map(x => x.toString()).includes(req.userId!) //TODO: go through once again 
    ) {
        const students = await UserModel.find({
            _id : classDb?.studentIds
        })
      res.json({
        success: true,
        data: {
          _id: classDb._id,
          className: classDb.className,
          teacherId: classDb.teacherId,
          students: students.map(s => ({ //TODO: go through once again 
            _id : s._id,
            name: s.name,
            email : s.email
          }))
        },
      });
    } else {
      res.status(403).json({
        success: false,
        error: "Forbidden , neither a teacher nor student ",
      });
    }
})

app.get("/students", authMiddleware, teacherMiddleware, async (req, res) => {
  const users = await UserModel.find({
    role: "student",
  });

  res.json({
    success: true,
    data: users.map(u => ({
        _id : u._id,
        name: u.name,
        email : u.email,
    }))
});
});

app.get("/class/:id/my-attendance", authMiddleware, async (req, res) => {
  const classId = req.params.id;
  const userId = req.userId;

  const attendance = await AttendanceModel.find({
    classId,
    studentId: userId,
  });
  if (attendance) {
    res.json({
      success: true,
      data: {
        classId: classId,
        status: "present",
      },
    });
  } else {
    res.json({
      success: true,
      data: {
        classId: classId,
        status: null,
      },
    });
  }
});

app.post('/attendance/start' ,authMiddleware , teacherMiddleware, async (req , res) => {
    const {success , data } = AttendanceStartSchema.safeParse(req.body)

    if (!success) {
        res.status(400).json({
            "success": false,
            "error": "Invalid request schema",
        })
        return
    }

    
})