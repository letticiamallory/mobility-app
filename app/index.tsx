import { Redirect } from 'expo-router';

/** Rota inicial `/`: envia para a splash; cadastro fica em `/register`. */
export default function Index() {
  return <Redirect href="/splash" />;
}
