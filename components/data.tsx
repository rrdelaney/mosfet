import { graphql, fragment, useFragment } from "../lib/hook";

interface CountryDataFragment {
  code: string;
  name: string;
}

export const CountryData = graphql`
  ${fragment`CountryData`} on Country {
    code
    name
  }
`;

export function Data({ country }: { country: CountryDataFragment }) {
  const { loading } = useFragment(CountryData);

  return <pre>{JSON.stringify(country, null, 2)}</pre>;
}
