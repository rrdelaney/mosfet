import { graphql, lazyFragment, useFragment } from "../lib/hook";

interface CountryDataFragment {
  capital: string;
}

export const CapitalData = graphql`
  ${lazyFragment`CapitalData`} on Country {
    capital
  }
`;

export function Capital({ country }: { country: CountryDataFragment }) {
  const { loading } = useFragment(CapitalData);

  return (
    <p>
      Capital: {loading && "Loading..."} {country.capital}
    </p>
  );
}
