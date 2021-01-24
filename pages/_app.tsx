import { MosfetEnvironment } from "../lib/hook";

function MyApp({ Component, pageProps }) {
  return (
    <MosfetEnvironment>
      <Component {...pageProps} />
    </MosfetEnvironment>
  );
}

export default MyApp;
