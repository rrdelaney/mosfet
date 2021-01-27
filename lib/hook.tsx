import * as React from "react";
import * as path from "path";

enum GraphQLDataKind {
  FRAGMENT = 1,
  QUERY,
  PART,
}

interface GraphQLFragmentData {
  kind: GraphQLDataKind.FRAGMENT;
  fragmentName: string;
  lazy: boolean;
}

export const fragment = (parts: TemplateStringsArray): GraphQLFragmentData => {
  return {
    kind: GraphQLDataKind.FRAGMENT,
    fragmentName: parts.join(""),
    lazy: false,
  };
};

export const lazyFragment = (
  parts: TemplateStringsArray
): GraphQLFragmentData => {
  return {
    kind: GraphQLDataKind.FRAGMENT,
    fragmentName: parts.join(""),
    lazy: true,
  };
};

interface GraphQLQueryData {
  kind: GraphQLDataKind.QUERY;
  queryName: string;
}

export const query = (parts: TemplateStringsArray): GraphQLQueryData => {
  return {
    kind: GraphQLDataKind.QUERY,
    queryName: parts.join(""),
  };
};

export interface GraphQLPartData {
  kind: GraphQLDataKind.PART;
  name: string;
  strings: string[];
  data: Array<GraphQLFragmentData | GraphQLQueryData | GraphQLPartData>;
  file?: string;
}

export const graphql = (
  strings: TemplateStringsArray,
  ...metadata: Array<GraphQLFragmentData | GraphQLQueryData | GraphQLPartData>
): GraphQLPartData => {
  let file: string | undefined;
  if (!process.browser && process.env.NODE_ENV !== "production") {
    const err: { stack?: string } = {};
    Error.captureStackTrace(err, graphql);

    const stackTrace = err.stack.split("\n");
    const fileMatch = stackTrace[1]?.match(/\.(\/\w+)+\.(t|s)sx?/);
    if (fileMatch) {
      const parentFile = fileMatch[0];
      const absolutePath = path.join(process.cwd(), parentFile);
      file = absolutePath;
    }
  }

  return {
    kind: GraphQLDataKind.PART,
    name: "",
    strings: Array.from(strings),
    data: Array.from(metadata),
    file,
  };
};

interface RenderPartOptions {
  renderedLazyFragments: Record<string, boolean>;
  renderForTypes?: boolean;
}

interface RenderedGraphQLQuery {
  query: string;
  name: string;
  deps: string[];
  depNames: string[];
}

const SKIPPED_FRAGMENT = Symbol("SKIPPED_FRAGMENT");

function renderPart(
  part: GraphQLPartData,
  opts: RenderPartOptions
): RenderedGraphQLQuery | typeof SKIPPED_FRAGMENT {
  const rendered: RenderedGraphQLQuery = {
    name: "",
    query: "",
    deps: [],
    depNames: [],
  };

  const partData = [...part.data];
  for (let str of part.strings) {
    rendered.query += str;
    const data = partData.shift();
    switch (data?.kind) {
      case GraphQLDataKind.FRAGMENT: {
        if (
          data.lazy &&
          !opts.renderForTypes &&
          !opts.renderedLazyFragments[data.fragmentName]
        ) {
          return SKIPPED_FRAGMENT;
        }
        rendered.name = data.fragmentName;
        rendered.query += `fragment ${data.fragmentName}`;
        break;
      }

      case GraphQLDataKind.QUERY: {
        rendered.name = data.queryName;
        rendered.query += `query ${data.queryName}`;
        break;
      }

      case GraphQLDataKind.PART: {
        const subPart = renderPart(data, opts);
        if (subPart === SKIPPED_FRAGMENT) {
          // Delete the ... token
          rendered.query = rendered.query.slice(0, -3);
        } else {
          rendered.deps.push(subPart.query, ...subPart.deps);
          rendered.depNames.push(subPart.name, ...subPart.depNames);
          rendered.query += subPart.name;
        }
        break;
      }
    }
  }

  return rendered;
}

export interface RenderedQuery {
  query: string;
  operationName: string;
  fetchedFragments: string[];
}

export function renderQuery(
  part: GraphQLPartData,
  opts: RenderPartOptions = { renderedLazyFragments: {} }
): RenderedQuery {
  if (!process.browser && process.env.NODE_ENV !== "production") {
    const renderedForTypes = renderPart(part, {
      renderedLazyFragments: {},
      renderForTypes: true,
    });

    // TODO: Write types to disk.
  }

  const rendered = renderPart(part, opts);
  if (rendered === SKIPPED_FRAGMENT) {
    throw new Error("Cannot render a fragment as a query");
  }

  return {
    query: [...rendered.deps, rendered.query].join("\n"),
    operationName: rendered.name,
    fetchedFragments: rendered.depNames,
  };
}

/**
 * Returns results of a GraphQL query.
 * @param queryPart Query containing any fragments from subcomponents.
 * @param data Initial data from getServerSideProps
 */
export function useQuery(queryPart: GraphQLPartData) {
  const mosfetEnv = React.useContext(MosfetContext);

  const query = React.useMemo(() => {
    const rendered = renderQuery(queryPart, {
      renderedLazyFragments: mosfetEnv.renderedLazyFragments,
    });

    return rendered;
  }, [queryPart, mosfetEnv]);

  return {
    ...query,
    didFetch: () => {
      mosfetEnv.fetchedFragments.current = new Set(query.fetchedFragments);
    },
  };
}

/**
 * Gets data from a fragment out of the GraphQL store.
 * @param fragment Fragment specifying data needed
 */
export function useFragment(part: GraphQLPartData) {
  const mosfetContext = React.useContext(MosfetContext);

  const fragment = React.useMemo(() => {
    const fragment = part.data[0];
    if (fragment.kind !== GraphQLDataKind.FRAGMENT) {
      throw new Error("Must use the fragment tag with useFragment");
    }

    return fragment;
  }, [part]);

  React.useEffect(() => {
    if (
      fragment.lazy &&
      !mosfetContext.renderedLazyFragments[fragment.fragmentName]
    ) {
      mosfetContext.updateLazyFragment(fragment.fragmentName, true);
    }

    return () => {
      if (
        fragment.lazy &&
        mosfetContext.renderedLazyFragments[fragment.fragmentName]
      ) {
        mosfetContext.updateLazyFragment(fragment.fragmentName, false);
      }
    };
  }, [fragment, mosfetContext]);

  const loading =
    fragment.lazy &&
    !mosfetContext.fetchedFragments.current.has(fragment.fragmentName);

  return { loading };
}

export function useMutation<MutationArgs = {}, MutationType = {}>(
  mutation: GraphQLPartData,
  args: MutationArgs
): MutationType {
  // (1) Compile and write types to disk.

  // (2) Send mutation to server.

  // (3) Refetch.

  return {} as MutationType;
}

interface MosfetContextValue {
  renderedLazyFragments: Record<string, boolean>;
  updateLazyFragment: (name: string, isLazy: boolean) => void;
  fetchedFragments: React.MutableRefObject<Set<string>>;
}

const MosfetContext = React.createContext<MosfetContextValue>({
  renderedLazyFragments: {},
  updateLazyFragment: () => {},
  fetchedFragments: React.createRef(),
});

export function MosfetEnvironment({ children }: React.PropsWithChildren<{}>) {
  const fetchedFragments = React.useRef<Set<string>>(new Set());

  const [renderedLazyFragments, setRendered] = React.useState<
    Record<string, boolean>
  >({});

  function updateLazyFragment(name: string, isRendered: boolean) {
    setRendered({
      ...renderedLazyFragments,
      [name]: isRendered,
    });
  }

  return (
    <MosfetContext.Provider
      value={{
        renderedLazyFragments,
        updateLazyFragment,
        fetchedFragments,
      }}
    >
      {children}
    </MosfetContext.Provider>
  );
}
