import { logger } from "./logging";
import * as util from "./util";
import { Collection, Db, MongoClient } from "mongodb";
import axios from "axios";
import * as querystring from "querystring";
import moment from "moment";
import isEmpty from "is-empty";

import { COLLECTION_UPDATE_INTERVAL, COLLECTION_METADATA } from "./models/metadata";
import { COLLECTION_WEATHER, weather_mapper } from "./models/weather";
import { COLLECTION_NEWS } from "./models/news";
import { COLLECTION_CORONA_STATE, corona_state_mapper } from "./models/corona_state";
import { coronaVaccineItem } from "./models/corona_city";
import { coronaCityItem } from "./models/corona_vaccine";

const DB_URL: string = "mongodb://localhost:27017";
const DB_NAME: string = "corona_db";

const DB_COLLECTION_CORONA_CITY: string = "corona_city";
const DB_COLLECTION_CORONA_VACCINE: string = "corona_vaccine";

let data_collection: Collection;
let weather_collection: Collection;
let news_collection: Collection;
let corona_state_collection: Collection;
let corona_city_collection: Collection;
let corona_vaccine_collection: Collection;

export const init_db = async () => {
    logger.info("initializing Database");
    let connection;
    try {
        connection = await MongoClient.connect(DB_URL, {
            useUnifiedTopology: true,
            useNewUrlParser: true,
        });
        logger.info("$$ Connected successfully to mongodb server : ", __filename);
        let mongo_db: Db = await connection.db(DB_NAME);

        data_collection = mongo_db.collection(COLLECTION_METADATA);
        weather_collection = mongo_db.collection(COLLECTION_WEATHER);
        news_collection = mongo_db.collection(COLLECTION_NEWS);
        corona_state_collection = mongo_db.collection(COLLECTION_CORONA_STATE);
        corona_city_collection = mongo_db.collection(DB_COLLECTION_CORONA_CITY);
        corona_vaccine_collection = mongo_db.collection(DB_COLLECTION_CORONA_VACCINE);
    } catch (error) {
        if (connection != null) {
            logger.error(error);
            connection.close();
        }
    }
};

async function metadata_update(param: string, data: number) {
    await data_collection
        .updateOne(
            { name: "metadata" },
            {
                $set: {
                    [param]: data,
                },
            },
            {
                upsert: true,
            }
        )
        .catch((err) => {
            logger.error(err);
        });
}

async function metadata_get(param: string): Promise<number> {
    return Promise.resolve(
        await data_collection
            .findOne({ name: "metadata" })
            .then((data) => {
                return Promise.resolve(data[param]);
            })
            .catch((err) => {
                logger.error("MONGODB error", err);
                return Promise.reject(0);
            })
    );
}

export const getCachedWeather = async (cities: string[]): Promise<object[]> => {
    logger.info("getCachedWeather", cities);

    let weathers: object[];
    let update_time = await metadata_get("weather_last_update");
    if ((update_time as number) + COLLECTION_UPDATE_INTERVAL < Date.now()) {
        await cachingWeather(update_time);
    }

    let query = {};
    if (isEmpty(cities)) {
        query = { last_update_time: update_time };
    } else {
        query = {
            name: { $in: cities },
            last_update_time: update_time,
        };
    }

    weathers = await weather_collection
        .find(query)
        .project({
            _id: 0,
        })
        .toArray();

    return Promise.resolve(weathers);
};

const cachingWeather = async (update_time: number = 0) => {
    logger.info("cachingWeather");

    let big_cities = util.CITIES;

    let requests = [] as any[];

    for (let key in big_cities) {
        let api_url =
            util.PREFERENCES.URL_WEATHER +
            querystring.stringify({
                appid: util.PREFERENCES.KEY_WEATHER,
                units: "metric",
                lang: "kr",
                id: key,
            });
        requests.push(axios.get(api_url));
    }
    let results = [] as any[];

    await axios.all(requests).then(
        axios.spread((...resp) => {
            resp.forEach((ele) => {
                let data = weather_mapper(
                    ele.data,
                    big_cities[ele.data.id]["name_kor"],
                    update_time
                );

                results.push(data);
            });
        })
    );

    await weather_collection.insertMany(results);
    await metadata_update("weather_last_update", update_time);
};

//TODO pagination 이상하면 다시하기
//네이버라 잘나와서 안했지만 시간되면 models 빼기
export const getCachedNews = async (page: number, page_count: number): Promise<object[]> => {
    logger.info("getCachedNews", page, page_count);

    let news: object[] = [];
    let update_time = await metadata_get("news_last_update");
    if ((update_time as number) + COLLECTION_UPDATE_INTERVAL < Date.now()) {
        await cachingNews(update_time);
    }

    let query = { last_update_time: update_time };

    let skip_page = page <= 1 ? 0 : (page - 1) * page_count;
    news = await news_collection
        .find(query)
        .skip(skip_page)
        .limit(page_count)
        .project({
            _id: 0,
        })
        .toArray();

    return Promise.resolve(news);
};

const cachingNews = async (update_time: number = 0) => {
    logger.info("cachingNews");

    let api_url =
        util.PREFERENCES.URL_NEWS +
        querystring.stringify({
            query: "코로나",
            display: 100,
            sort: "sim",
        });

    await axios
        .get(api_url, {
            headers: {
                "X-Naver-Client-Id": util.PREFERENCES.KEY_NAVER_CLIENT_ID,
                "X-Naver-Client-Secret": util.PREFERENCES.KEY_NAVER_CLIENT_SECRET,
            },
        })
        .then(async (resp) => {
            let data = resp.data.items;

            data.map((obj: any) => {
                obj["last_update_time"] = update_time;
            });

            await news_collection.insertMany(data);
            await metadata_update("news_last_update", update_time);
        });
};

export const getCachedCoronaState = async (): Promise<object[]> => {
    logger.info("getCachedCoronaState");

    let corona_states: object[] = [];

    let update_time = await metadata_get("corona_state_last_update");
    // if ((update_time as number) + COLLECTION_UPDATE_INTERVAL < Date.now()) {
    await cachingCoronaState();
    // }

    let query = { last_update_time: update_time };

    corona_states = await corona_state_collection
        .find(query)
        .project({
            _id: 0,
        })
        .toArray();

    return Promise.resolve(corona_states);
};

//TODO 날짜별 하나만 갖게
const cachingCoronaState = async (update_time: number = 0) => {
    logger.info("cachingCoronaState");

    var api_url =
        util.PREFERENCES.URL_CORONA_STATE +
        querystring.stringify({
            ServiceKey: util.PREFERENCES.KEY_CORONA_STATE,
            pageNo: 1,
            numOfRows: 50,
            startCreateDt: moment().subtract(5, "days").format("YYYYMMDD"), // 5일 전
            endCreateDt: moment().format("YYYYMMDD"), // 오늘
        });

    await axios.get(api_url).then(async (resp) => {
        let data = resp.data.response.body.items.item;

        data.map((obj: any) => {
            obj = corona_state_mapper(obj, update_time);

            return obj;
        });

        await corona_state_collection.insertMany(data);
        await metadata_update("corona_state_last_update", update_time);
    });
};

//TODO async await, error 처리
//query sort by last_update_time desc, query cities find -> return
export const getCachedCoronaCity = async (cities: string[]): Promise<coronaCityItem[]> => {
    console.log("getCachedCoronaCity");
    console.log(cities);

    let corona_cities: coronaCityItem[] = [];

    let update_time = await metadata_get("corona_city_last_update");
    if ((update_time as number) + COLLECTION_UPDATE_INTERVAL < Date.now()) {
        await cachingCoronaCity();
    }

    // corona_cities = await weather_collection.find({
    //     city: { $in: cities },
    // }).toArray();
    corona_cities = await corona_city_collection.find({}).toArray();
    return Promise.resolve(corona_cities);
};

//TODO async await, error 처리
// api request, response 명세
const cachingCoronaCity = async () => {
    console.log("cachingCoronaCity");

    var api_url =
        util.PREFERENCES.URL_CORONA_CITY +
        querystring.stringify({
            ServiceKey: util.PREFERENCES.KEY_CORONA_CITY, //TODO
            pageNo: 1,
            numOfRows: 10, //TODO
            startCreateDt: "20210624", //TODO
            endCreateDt: "20210624", //TODO
        });

    await axios.get(api_url).then(async (resp) => {
        let data = resp.data.response.body.items.item;
        let update_time = Date.now();

        data.forEach((element: any) => {
            element.last_update_time = update_time;
        });

        await corona_city_collection.insertMany(data);
        await metadata_update("corona_city_last_update", update_time);
    });
};

//TODO async await, error 처리
//query sort by last_update_time desc, query cities find -> return
export const getCachedCoronaVaccine = async (cities: string[]): Promise<coronaVaccineItem[]> => {
    console.log("getCachedCoronaVaccine");
    console.log(cities);

    let corona_vaccines: coronaVaccineItem[] = [];

    let update_time = await metadata_get("corona_vaccine_last_update");

    if ((update_time as number) + COLLECTION_UPDATE_INTERVAL < Date.now()) {
        await cachingCoronaVaccine();
    }

    await cachingCoronaVaccine();

    // corona_vaccines = await corona_vaccine_collection.find({
    //     city: { $in: cities },
    // }).toArray();
    corona_vaccines = await corona_vaccine_collection.find({}).toArray();

    return Promise.resolve(corona_vaccines);
};

//TODO async await, error 처리
const cachingCoronaVaccine = async () => {
    console.log("cachingCoronaVaccine");

    var api_url =
        util.PREFERENCES.URL_CORONA_VACCINE +
        querystring.stringify({
            page: 1,
            perPage: 500,
            returnType: "json",
            serviceKey: util.PREFERENCES.KEY_CORONA_VACCINE,
        });

    await axios.get(api_url).then(async (resp) => {
        let data = resp.data.data;
        let update_time = Date.now();

        data.forEach((element: any) => {
            element.last_update_time = update_time;
        });

        await corona_vaccine_collection.insertMany(data);
        await metadata_update("corona_vaccine_last_update", update_time);
    });
};
