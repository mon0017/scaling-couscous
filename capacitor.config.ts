// Native packaging scaffold. Set APP_ORIGIN to the deployed HTTPS application origin.
const origin=process.env.APP_ORIGIN;
if(origin&&!origin.startsWith('https://'))throw Error('APP_ORIGIN must use HTTPS');
export default {appId:'org.unionnest.portal',appName:'JohnLoan Baba Yaga',webDir:'native-shell',server:origin?{url:origin,cleartext:false}:undefined,ios:{contentInset:'automatic'},plugins:{SplashScreen:{launchShowDuration:1500,backgroundColor:'#102f40'},PushNotifications:{presentationOptions:['badge','sound','alert']}}};

