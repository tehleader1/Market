import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();

app.use(cors());
app.use(express.json());

let productHuntToken = null;

async function getProductHuntToken() {

  if (productHuntToken) {
    return productHuntToken;
  }

  const response = await fetch(
    "https://api.producthunt.com/v2/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        client_id: process.env.PRODUCTHUNT_CLIENT_ID,
        client_secret: process.env.PRODUCTHUNT_CLIENT_SECRET,
        grant_type: "client_credentials"
      })
    }
  );

  const data = await response.json();

  productHuntToken = data.access_token;

  return productHuntToken;
}

app.get("/api/producthunt/listings", async (req, res) => {

  try {

    const token = await getProductHuntToken();

    const query = `
      query {
        posts(first: 10) {
          edges {
            node {
              id
              name
              tagline
              url
              votesCount
              commentsCount
            }
          }
        }
      }
    `;

    const phResponse = await fetch(
      "https://api.producthunt.com/v2/api/graphql",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query })
      }
    );

    const result = await phResponse.json();

    res.json(result);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      error: "Product Hunt API failed"
    });

  }

});

app.listen(3001, () => {

  console.log("Dojj integrations running on port 3001");

});
