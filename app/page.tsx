// Server component — HomeClient (interactive) + Footer (server) birleştirir
import HomeClient from './_components/HomeClient';
import Footer from './_components/Footer';

export default function Home() {
  return (
    <>
      <HomeClient />
      <Footer />
    </>
  );
}
