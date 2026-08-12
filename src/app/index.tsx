import { Redirect } from 'expo-router';

/** Boot: signed out, so land on the Welcome onboarding flow. */
export default function Index() {
  return <Redirect href="/welcome" />;
}
