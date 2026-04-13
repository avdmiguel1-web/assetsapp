import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId:    "com.tgsiat.fleetcore",
  appName:  "FleetCore",
  webDir:   "dist",
  server: {
    androidScheme: "https",
    // Allow Flespi and Supabase calls from the native app
    allowNavigation: ["*.flespi.io", "*.supabase.co"],
  },
  plugins: {
    StatusBar: {
      style: "Light",
      backgroundColor: "#ffffff",
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor:    "#f0f4f8",
      showSpinner:        false,
    },
  },
};

export default config;
