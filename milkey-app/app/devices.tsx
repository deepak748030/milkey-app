import React from 'react';
import { View, Text, StatusBar } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DeviceManager from '@/components/DeviceManager';

export default function DevicesScreen(){
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const headerBg = isDark ? '#0A1F12' : '#123F1A';
  return (
    <View style={{flex:1, backgroundColor:colors.background}}>
      <StatusBar backgroundColor={headerBg} barStyle="light-content" translucent={false} />
      <View style={{flexDirection:'row', alignItems:'center', paddingTop: insets.top + 8, paddingHorizontal:12, paddingBottom:12, backgroundColor:headerBg, gap:8}}>
        <Pressable onPress={()=>router.back()} style={{width:36,height:36,alignItems:'center',justifyContent:'center', borderRadius:10, backgroundColor:'rgba(255,255,255,0.14)', borderWidth:1, borderColor:'rgba(255,255,255,0.2)'}}>
          <ArrowLeft size={18} color="#fff"/>
        </Pressable>
        <View style={{width:36,height:36,borderRadius:10,backgroundColor:'rgba(255,255,255,0.14)',alignItems:'center',justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.2)'}}>
          <ShieldCheck size={18} color="#fff"/>
        </View>
        <View style={{flex:1}}>
          <Text style={{fontSize:15,fontWeight:'800',color:'#fff'}}>Sessions & Devices</Text>
          <Text style={{fontSize:11,color:'rgba(255,255,255,0.8)',marginTop:1}}>Real device sessions — logout, revoke, track IP</Text>
        </View>
      </View>
      <DeviceManager/>
    </View>
  );
}
