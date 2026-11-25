import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    // React Compiler rules new in eslint-plugin-react-hooks 7 (Next.js 16).
    // Existing components predate them; report as warnings until they are refactored.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      ".neutronium-dev/**",
      "node_modules/**",
      "out/**",
      "public/**",
      "brag-output/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
