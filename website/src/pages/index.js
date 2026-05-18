import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import styles from './index.module.css';

export default function Home() {
  return (
    <Layout title="Caos en Mano" description="Documentación de diseño del juego">
      <main className={styles.heroBanner}>
        <div className="container">
          <h1>Caos en Mano</h1>
          <p>Roguelike deckbuilder donde cada desastre es exactamente el plan.</p>
          <Link className="button button--primary button--lg" to="/docs/gdd/game-concept">
            Ver documentación
          </Link>
        </div>
      </main>
    </Layout>
  );
}
