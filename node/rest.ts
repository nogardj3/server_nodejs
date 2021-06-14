import express from "express";
import cors from "cors";
import { logger } from "./logging";
import { api_doc_app } from "./api_docs";
import * as database from "./caching_db";
import * as util from "./util";
import axios from "axios";
import * as graphql from "graphql";

class App {
    public application: express.Application;

    constructor() {
        this.application = express();
    }
}

const app = new App().application;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/api-docs", api_doc_app);

/**
 * @swagger
 *
 * /getweather:
 *   get:
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: username
 *         in: formData
 *         required: true
 *         type: string
 *       - name: password
 *         in: formData
 *         required: true
 *         type: string
 */
app.get("/getweather", (req: express.Request, res: express.Response) => {});

/**
 * @swagger
 *
 * /getnews:
 *   get:
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: username
 *         in: formData
 *         required: true
 *         type: string
 *       - name: password
 *         in: formData
 *         required: true
 *         type: string
 */
app.get("/getnews", (req: express.Request, res: express.Response) => {});

/**
 * @swagger
 *
 * /getqrinfo:
 *   get:
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: username
 *         in: formData
 *         required: true
 *         type: string
 *       - name: password
 *         in: formData
 *         required: true
 *         type: string
 */
app.get("/getweather", (req: express.Request, res: express.Response) => {});

export const createServer = (port1: number) => {
    app.listen(port1, function () {
        console.log("=== rest server on port " + port1);
        database.init_db();
    });
};
