import express from "express";
import http from "http";
import {
  AddStudentSchema,
  AttendanceStartSchema,
  CreateClassSchema,
  LoginSchema,
  SignupSchema,
} from "./types";
import { AttendanceModel, ClassModel, UserModel } from "./models";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { authMiddleware, teacherMiddleware } from "./middleware";
import mongoose from "mongoose";
import { WebSocketServer, WebSocket } from "ws";

const app = express();

const server = http.createServer(app);

app.use(express.json());
const port = 3000;
server.listen(port);
console.log(`seever running at port ${port}`);

const wss = new WebSocketServer({ server, path: "/ws" });

let activeSession: {
  classId: string;
  startedAt: Date;
  attendance: Record<string, string>;
} | null = null;

wss.on("connection", (ws, req) => {
  try {
    const url = new URL(req.url!, "http://localhost");
    const token = url.searchParams.get("token");

    if (!token) {
      ws.send(
        JSON.stringify({
          event: "ERROR",
          data: {
            message: "Unauthorized or invalid token",
          },
        }),
      );
      ws.close();
      return;
    }

    const { userId, role } = jwt.verify(
      token!,
      process.env.JWT_PASSWORD!,
    ) as JwtPayload;

    ws.user = {
      userId,
      role,
    };

    ws.on("message", async (msg) => {
      const message = msg.toString();
      let parsedData;
      try {
        parsedData = JSON.parse(message);
      } catch {
        ws.send(
          JSON.stringify({
            event: "ERROR",
            data: {
              message: "Invalid JSON ",
            },
          }),
        );
        ws.close();
        return;
      }
      console.log("EVENT RECIEVED : ", parsedData.event);

      switch (parsedData.event) {
        case "ATTENDANCE_MARKED":
          if (ws.user?.role == "teacher") {
            if (!activeSession) {
              ws.send(
                JSON.stringify({
                  event: "ERROR",
                  data: {
                    message: "No active attendance session",
                  },
                }),
              );
              ws.close();
              return;
            } else {
              activeSession.attendance[parsedData.data.studentId] =
                parsedData.data.status;

              wss.clients.forEach((client) => {
                client.send(
                  JSON.stringify({
                    event: "ATTENDANCE_MARKED",
                    data: {
                      studentId: parsedData.data.studentId,
                      status: parsedData.data.status,
                    },
                  }),
                );
              });
            }
          } else {
            ws.send(
              JSON.stringify({
                event: "ERROR",
                data: {
                  message: "Forbidden, teacher event only",
                },
              }),
            );
          }
          break;
        case "TODAY_SUMMARY":
          if (ws.user?.role === "teacher") {
            const UserDb = await ClassModel.find({
              _id: activeSession?.classId,
            });
            const total = UserDb.length;
            const present = Object.keys(activeSession?.attendance || []).filter(
              (x) => activeSession?.attendance[x] === "present",
            ).length;
            const absent = total - present;
            wss.clients.forEach((client) => {
              client.send(
                JSON.stringify({
                  event: "TODAY_SUMMARY",
                  data: {
                    present,
                    absent,
                    total,
                  },
                }),
              );
            });
          }
      }
    });
  } catch (e) {
    ws.send(
      JSON.stringify({
        event: "ERROR",
        data: {
          message: "Unauthorized or invalid token",
        },
      }),
    );
    ws.close();
    return;
  }
});

app.post("/auth/signup", async (req, res) => {
  const { success, data } = SignupSchema.safeParse(req.body);

  if (!success) {
    res.status(400).json({
      success: false,
      error: "Invalid request schema",
    });
    return;
  }
  const user = await UserModel.findOne({
    email: data?.email,
  });

  if (user) {
    res.status(400).json({
      success: false,
      error: "Email already exists",
    });
    return;
  }

  const userDb = await UserModel.create({
    name: data?.name,
    email: data?.email,
    password: data?.password,
    role: data?.role,
  });

  res.status(201).json({
    success: true,
    data: {
      _id: userDb._id,
      name: userDb.name,
      email: userDb.email,
      role: userDb.role,
    },
  });
});

app.post("/auth/login", async (req, res) => {
  const { success, data } = LoginSchema.safeParse(req.body);

  if (!success) {
    res.status(400).json({
      success: false,
      error: "Invalid request schema",
    });
    return;
  }

  const userDb = await UserModel.findOne({
    email: data?.email,
  });

  if (!userDb || userDb.password != data.password) {
    res.status(400).json({
      success: false,
      error: "Invalid email or password",
    });
    return;
  }
  const token = jwt.sign(
    {
      role: userDb.role,
      userId: userDb._id,
    },
    process.env.JWT_PASSWORD!,
  );

  res.json({
    success: true,
    data: {
      token,
    },
  });
  return;
});

app.get("/auth/me", authMiddleware, async (req, res) => {
  const userDb = await UserModel.findOne({
    _id: req.userId,
  });

  if (!userDb) {
    res.status(400).json({
      message: "you cannot reach here ",
    });
  }

  res.json({
    success: true,
    data: {
      _id: userDb?._id,
      name: userDb?.name,
      email: userDb?.email,
      role: userDb?.role,
    },
  });
});

app.post("/class", authMiddleware, teacherMiddleware, async (req, res) => {
  const { success, data } = CreateClassSchema.safeParse(req.body);

  if (!success) {
    res.status(400).json({
      success: false,
      error: "Invalid request schema",
    });
    return;
  }

  const classDb = await ClassModel.create({
    className: data.className,
    teacherId: req.userId,
    studentIds: [],
  });

  res.status(201).json({
    success: true,
    data: {
      _id: classDb._id,
      className: classDb.className,
      teacherId: classDb.teacherId,
      studentIds: [],
    },
  });
});

app.post(
  "/class/:id/add-student",
  authMiddleware,
  teacherMiddleware,
  async (req, res) => {
    const { success, data } = AddStudentSchema.safeParse(req.body);

    if (!success) {
      res.status(400).json({
        success: false,
        error: "Invalid request schema",
      });
      return;
    }

    const classDb = await ClassModel.findOne({
      _id: req.params.id,
    });

    if (!classDb) {
      res.status(404).json({
        success: false,
        error: "Class not found",
      });
      return;
    }

    const userDb = await UserModel.findOne({
      _id: data.studentId,
    });

    if (!userDb) {
      res.status(404).json({
        success: false,
        error: "Student not found",
      });
      return;
    }

    // do not add duplicae students just send the data of the user
    if (classDb.studentIds.map((s) => s.toString()).includes(data.studentId)) {
      res.json({
        success: true,
        data: {
          _id: classDb._id,
          className: classDb.className,
          teacherId: classDb.teacherId,
          studentIds: classDb.studentIds,
        },
      });
      return;
    }

    // TODO: clear this
    if (classDb.teacherId?.toString() !== req.userId) {
      res.status(403).json({
        success: false,
        error: "Forbidden, not class teacher",
      });
      return;
    }

    // TODO: Understand what is this
    classDb.studentIds.push(new mongoose.Types.ObjectId(data.studentId));
    await classDb.save();

    res.json({
      success: true,
      data: {
        _id: classDb._id,
        className: classDb.className,
        teacherId: classDb.teacherId,
        studentIds: classDb.studentIds,
      },
    });
  },
);

app.get("/class/:id", authMiddleware, async (req, res) => {
  const classDb = await ClassModel.findOne({
    _id: req.params.id,
  });
  if (!classDb) {
    res.status(404).json({
      success: false,
      error: "Class not found",
    });
    return;
  }

  if (
    classDb?.teacherId == req.userId ||
    classDb?.studentIds.map((x) => x.toString()).includes(req.userId!) //TODO: go through once again
  ) {
    const students = await UserModel.find({
      _id: classDb?.studentIds,
    });
    res.json({
      success: true,
      data: {
        _id: classDb._id,
        className: classDb.className,
        teacherId: classDb.teacherId,
        students: students.map((s) => ({
          //TODO: go through once again
          _id: s._id,
          name: s.name,
          email: s.email,
        })),
      },
    });
  } else {
    res.status(403).json({
      success: false,
      error: "Forbidden, not class teacher",
    });
  }
});

app.get("/students", authMiddleware, teacherMiddleware, async (req, res) => {
  const users = await UserModel.find({
    role: "student",
  });

  res.json({
    success: true,
    data: users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
    })),
  });
});

app.get("/class/:id/my-attendance", authMiddleware, async (req, res) => {
  const classId = req.params.id;
  const userId = req.userId;

  const attendance = await AttendanceModel.findOne({
    classId,
    studentId: userId, //TODO: what if the user is teacher
  });

  if (req.role !== "student") {
    res.json({
      success: false,
      error: "Forbidden, Student access required",
    });
    return;
  }

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

app.post(
  "/attendance/start",
  authMiddleware,
  teacherMiddleware,
  async (req, res) => {
    const { success, data } = AttendanceStartSchema.safeParse(req.body);

    if (!success) {
      res.status(400).json({
        success: false,
        error: "Invalid request schema",
      });
      return;
    }
    const classDb = await ClassModel.findOne({
      _id: data.classId,
    });

    if (!classDb) {
      res.status(404).json({
        success: false,
        error: "Class not found",
      });
      return;
    }

    if (classDb.teacherId?.toString() !== req.userId) {
      res.status(403).json({
        success: false,
        error: "Forbidden, not class teacher",
      });
      return;
    }

    // TODO: clear this
    activeSession = {
      classId: classDb._id.toString(),
      startedAt: new Date(),
      attendance: {},
    };

    res.json({
      success: true,
      data: {
        classId: classDb._id,
        startedAt: activeSession.startedAt,
      },
    });
  },
);
