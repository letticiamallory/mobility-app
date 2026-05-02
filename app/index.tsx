import { Redirect } from 'expo-router';

/** Rota raiz `/`: envia para a splash; cadastro em `/register`. */
export default function Index() {
  return <Redirect href="/splash" />;
}
