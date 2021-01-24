import { GetServerSideProps } from "next";
import * as React from "react";
import got from "got";
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
  data: HomeQueryType;
}

export default function Home({ data }: HomeProps) {
  const query = useQuery(HomeQuery, data);
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

      <Data country={query.usa} />

      {showCapital && <Capital country={query.usa} />}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<HomeProps> = async () => {
  const serverQuery = renderQuery(HomeQuery);
  const { body } = await got.post("https://countries.trevorblades.com/", {
    json: {
      operationName: serverQuery.operationName,
      variables: {},
      query: serverQuery.query,
    },
    responseType: "json",
  });

  return {
    props: {
      data: (body as any).data as HomeQueryType,
    },
  };
};
