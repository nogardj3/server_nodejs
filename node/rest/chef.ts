import express from "express";
import cors from "cors";
import { logger } from "../logging";
import * as util from "../util";
import isEmpty from "is-empty";
import * as database from "../database_chef";
import { userInfo } from "os";

class App {
    public application: express.Application;

    constructor() {
        this.application = express();
    }
}

export const chef_app = new App().application;
chef_app.use(cors());
chef_app.use(express.json());
chef_app.use(express.urlencoded({ extended: false }));

chef_app.post("/clear", async (req: express.Request, res: express.Response) => {
    const pw: string = req.body.keyword as string;
    const collection_name: string = req.body.collection_name as string;

    if (pw != util.PREFERENCES.DB_CLEAR_KEYWORD) res.status(401).send("unauthorized");
    else {
        let is_cleared = await database.clearDB(collection_name);
        if (is_cleared) res.send("ok");
        else res.status(404).send("internal error");
    }
});

chef_app.get("/faq", async (req: express.Request, res: express.Response) => {
    let data = await database.getFAQ();

    res.send(data);
});
chef_app.get("/notice", async (req: express.Request, res: express.Response) => {
    let data = await database.getNotice();

    res.send(data);
});
chef_app.get("/tos", async (req: express.Request, res: express.Response) => {
    res.send(util.CHEF_TOS);
});

chef_app.post("/user/check/", async (req: express.Request, res: express.Response) => {
    logger.info("user check", req.body);

    let token = req.body.user_token as string;
    let uid = req.body.user_id as string;

    let result: any = await database.checkUserInfo(token, uid);
    console.log(result);

    if (result["value"] != null) {
        res.send(result);
    } else {
        res.status(404).send({
            message: "data not found",
        });
    }
});

chef_app.post("/user/signup", async (req: express.Request, res: express.Response) => {
    logger.info("user signup", req.body);

    let result = await database.createUser(req.body);
    console.log(result);

    if (Object.keys(result).length == 0)
        res.status(403).send({
            message: "nickname already exists",
        });
    else {
        res.send(result);
    }
});

chef_app.get("/user/follower", async (req: express.Request, res: express.Response) => {
    logger.info("user follower", req.query);

    let result = await database.getFollower(req.query.user_id, req.query.target_id);

    res.send(result);
});

chef_app.get("/user/following", async (req: express.Request, res: express.Response) => {
    logger.info("user following", req.query);

    let result = await database.getFollowing(req.query.user_id, req.query.target_id);

    res.send(result);
});

chef_app.get("/comment", async (req: express.Request, res: express.Response) => {
    logger.info("comment list", req.query);

    let result = await database.getComment(req.query.post_id);

    res.send(result);
});

chef_app.post("/comment/create", async (req: express.Request, res: express.Response) => {
    logger.info("comment create", req.body);

    let result = await database.createComment(
        req.body.post_id,
        req.body.user_id,
        req.body.contents,
        req.body.datetime
    );

    if (result == "OK") res.send({ ok: result });
    else res.status(500).send({ ok: result });
});

chef_app.post("/comment/delete", async (req: express.Request, res: express.Response) => {
    logger.info("comment delete", req.body);

    let result = await database.deleteComment(req.body.comment_id);

    if (result == "OK") res.send({ ok: result });
    else res.status(500).send({ ok: result });
});
