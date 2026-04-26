import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Hierarchical, with TTL',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        Organise cache data into namespaces of any depth. Pass{' '}
        <code>{'{ ttl: ms }'}</code> to <code>set()</code> and entries expire
        automatically — no background timer.
      </>
    ),
  },
  {
    title: 'Observables, deduplicated',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        <code>cacheObservable()</code> wraps any HTTP call, caches the result,
        and shares one subscription across N concurrent callers via{' '}
        <code>shareReplay</code>. Built-in fallback on error.
      </>
    ),
  },
  {
    title: 'Persistence with compression',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Opt in to <code>localStorage</code> persistence with one provider call.
        Plug in <code>LzStringCompressor</code> to halve your snapshot size, or
        ship your own <code>ICompressor</code>.
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
