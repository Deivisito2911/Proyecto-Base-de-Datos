import { plainToClass } from "class-transformer";
import { validateOrReject } from "class-validator";
import dotenv from "dotenv";
import "es6-shim";
import express, { Express, Request, Response } from "express";
import { Pool } from "pg";
import "reflect-metadata";
import { Board } from "./dto/board.dto";
import { User } from "./dto/user.dto";

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: +process.env.DB_PORT!,
});

const app: Express = express();
const port = process.env.PORT || 3000;
app.use(express.json());

app.get("/users", async (req: Request, res: Response) => {
  try {
    const text = "SELECT id, name, email FROM users";
    const result = await pool.query(text);
    res.status(200).json(result.rows);
  } catch (errors) {
    return res.status(400).json(errors);
  }
});

app.post("/users", async (req: Request, res: Response) => {
  let userDto: User = plainToClass(User, req.body);
  try {
    await validateOrReject(userDto);

    const text = "INSERT INTO users(name, email) VALUES($1, $2) RETURNING *";
    const values = [userDto.name, userDto.email];
    const result = await pool.query(text, values);
    res.status(201).json(result.rows[0]);
  } catch (errors) {
    return res.status(422).json(errors);
  }
});

app.get("/boards", async (req: Request, res: Response) => {
  try {
    const text =
      'SELECT b.id, b.name, bu.userId "adminUserId" FROM boards b JOIN board_users bu ON bu.boardId = b.id WHERE bu.isAdmin IS true';
    const result = await pool.query(text);
    res.status(200).json(result.rows);
  } catch (errors) {
    return res.status(400).json(errors);
  }
});

app.post("/boards", async (req: Request, res: Response) => {
  let boardDto: Board = plainToClass(Board, req.body);
  const client = await pool.connect();
  try {
    client.query("BEGIN");
    await validateOrReject(boardDto, {});

    const boardText = "INSERT INTO boards(name) VALUES($1) RETURNING *";
    const boardValues = [boardDto.name];
    const boardResult = await client.query(boardText, boardValues);

    const boardUserText =
      "INSERT INTO board_users(boardId, userId, isAdmin) VALUES($1, $2, $3)";
    const boardUserValues = [
      boardResult.rows[0].id,
      boardDto.adminUserId,
      true,
    ];
    await client.query(boardUserText, boardUserValues);

    client.query("COMMIT");
    res.status(201).json(boardResult.rows[0]);
  } catch (errors) {
    client.query("ROLLBACK");
    return res.status(422).json(errors);
  } finally {
    client.release();
  }
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
