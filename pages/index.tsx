import { GetServerSideProps } from "next";
import * as React from "react";
import useSWR from "swr";
import axios from "axios";
import { Capital, CapitalData } from "../components/capital";
import { CountryData, Data } from "../components/data";
import { graphql, useQuery, query, renderQuery } from "../lib/hook";

const HomeQuery = graphql`
  ${query`Home`} {
    usa: country(code: "US") {
      ...${CountryData}
      ...${CapitalData}
    }
  }
`;

interface HomeQueryType {
  usa: {
    code: string;
    name: string;
    capital: string;
  };
}

interface HomeProps {
  homeQuery: HomeQueryType;
}

export default function Home({ homeQuery }: HomeProps) {
  const { query, didFetch } = useQuery(HomeQuery);
  const { data } = useSWR(query, fetcher, {
    onSuccess: didFetch,
    // TODO: Work around https://github.com/vercel/swr/issues/284.
    initialData: homeQuery,
  });

  console.log(query, data);

  const [showCapital, setShowCapital] = React.useState(false);

  return (
    <div>
      <button
        onClick={() => {
          setShowCapital(!showCapital);
        }}
      >
        Show capital
      </button>

      <Data country={data.usa} />

      {showCapital && <Capital country={data.usa} />}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<HomeProps> = async () => {
  const { query } = renderQuery(HomeQuery);
  const homeQuery = await fetcher(query);
  return {
    props: {
      homeQuery,
    },
  };
};

async function fetcher(query: string): Promise<HomeQueryType> {
  const { data } = await axios.post("https://countries.trevorblades.com/", {
    query,
    // operationName,
    variables: {},
  });

  return data.data;
}
