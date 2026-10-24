import React, { useEffect, useState, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Image, ActivityIndicator, ScrollView } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { PlayCircle, Video } from 'lucide-react-native';
import { API_BASE_URL as API_BASE } from '@/lib/apiConfig';

const DEFAULT_VIDEOS = [
  { _id: 'default-v1', title: 'How to add farmer in Milkey', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg' },
  { _id: 'default-v2', title: 'Milk collection entry guide', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg' },
  { _id: 'default-v3', title: 'Rate Setting explained', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg' },
  { _id: 'default-v4', title: 'Payments & reports tutorial', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg' },
  { _id: 'default-v5', title: 'Milkey full app overview', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg' },
];

export default memo(function HomeVideoSection(){
  const { colors }=useTheme();
  const [videos,setVideos]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{ fetch(`${API_BASE}/videos`).then(r=>r.json()).then(d=>{
    const list = d?.success ? (d.response?.slice(0,5)||[]) : [];
    setVideos(list.length ? list : DEFAULT_VIDEOS);
  }).catch(()=> setVideos(DEFAULT_VIDEOS)).finally(()=>setLoading(false));},[]);
  const styles=createStyles(colors);
  if(loading) return <View style={styles.wrap}><ActivityIndicator color={colors.primary} /></View>;
  const display = (videos && videos.length) ? videos : DEFAULT_VIDEOS;
  return (
    <View style={styles.wrap}>
      <View style={styles.header}><Video size={16} color={colors.primary} /><Text style={styles.title}>Learn with videos</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:8 }}>
        {display.map(v=>(
          <Pressable key={v._id} onPress={()=> v.youtubeUrl && Linking.openURL(v.youtubeUrl)} style={styles.card}>
            {v.thumbnail ? <Image source={{ uri:v.thumbnail }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor:colors.muted, alignItems:'center', justifyContent:'center'}]}><PlayCircle size={28} color={colors.primary} /></View>}
            <Text style={styles.vTitle} numberOfLines={2}>{v.title}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
});
const createStyles=(c:any)=>StyleSheet.create({
  wrap:{ marginTop:14, paddingHorizontal:2 },
  header:{ flexDirection:'row', alignItems:'center', gap:6, marginBottom:8 },
  title:{ fontSize:14, fontWeight:'700', color:c.foreground },
  card:{ width:160, backgroundColor:c.card, borderWidth:1, borderColor:c.border, borderRadius:10, overflow:'hidden' },
  thumb:{ width:160, height:90 },
  vTitle:{ fontSize:12, fontWeight:'600', color:c.foreground, padding:8 },
});
