import { useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Platform } from 'react-native';
const KEY_OPENS='milkey_app_opens';
const KEY_RATED='milkey_rated';
const KEY_LAST_PROMPT='milkey_last_rating_prompt';
const PLAY_STORE_URL='https://play.google.com/store/apps/details?id=com.milkey.app';

export function useAppRating(){
  const trackOpen = useCallback(async ()=>{
    try{
      const cur = parseInt((await AsyncStorage.getItem(KEY_OPENS))||'0',10);
      const next = cur+1;
      await AsyncStorage.setItem(KEY_OPENS, String(next));
      // prompt on 3rd, 8th opens
      if(next===3 || next===8){
        const last = await AsyncStorage.getItem(KEY_LAST_PROMPT);
        if(last){ const days = (Date.now()-parseInt(last,10))/(1000*60*60*24); if(days<7) return; }
        const rated = await AsyncStorage.getItem(KEY_RATED);
        if(rated) return;
        // delay slightly so Home renders
        setTimeout(()=> promptRating(), 1200);
      }
    }catch{}
  },[]);

  const promptRating = async ()=>{
    try{
      await AsyncStorage.setItem(KEY_LAST_PROMPT, String(Date.now()));
      Alert.alert('Enjoying Milkey?', 'Tap to rate us on Play Store — it helps a lot!',[
        { text:'Later', style:'cancel' },
        { text:'Rate now', onPress: async ()=>{
          await AsyncStorage.setItem(KEY_RATED,'1');
          if(Platform.OS==='android'){ Linking.openURL(PLAY_STORE_URL); }
          else Linking.openURL('https://milkey.app');
        }}
      ]);
    }catch{}
  };

  const openStore = ()=> Linking.openURL(PLAY_STORE_URL);

  useEffect(()=>{ trackOpen(); },[trackOpen]);

  return { promptRating, openStore };
}
