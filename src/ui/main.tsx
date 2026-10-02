import { render } from "preact";
import { App } from "./app.js";
import { requestQuote } from "./quote-client.js";
import "./styles.css";

const root = document.getElementById("app");
if (!root) {
  throw new Error("Missing #app mount point");
}
render(<App startQuote={requestQuote} />, root);
