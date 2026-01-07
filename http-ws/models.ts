import mongoose from "mongoose";
await mongoose.connect(process.env.MONGO_URL!)

const Schema = mongoose.Schema;

const UserSchema = new Schema({
   name: String,
   email: { type: String, unique: true },
   password: String,
   role: { type: String, enum: ['student', 'teacher'] }
})

const ClassSchema = new Schema({
   className: String,
   teacherId: { type: mongoose.Types.ObjectId, ref: "Users" },
   studentIds: [{ type: mongoose.Types.ObjectId, ref: "Users" }],

})

const AttendanceSchema = new Schema({
   status: { type: String, enum: ['present', 'absent'] },
   classId: { type: mongoose.Types.ObjectId, ref: "Class" },
   studentId: { type: mongoose.Types.ObjectId, ref: "Users" }
})

export const UserModel = mongoose.model('Users', UserSchema)
export const ClassModel = mongoose.model('class', ClassSchema)
export const AttendanceModel = mongoose.model('Attendance', AttendanceSchema)
