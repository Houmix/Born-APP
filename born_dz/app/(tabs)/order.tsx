import {Text, View, StyleSheet} from 'react-native';
import { POS_URL } from "@/config";
export default function OrderScreen() {
    return (
        <View style={styles.container}>
            <View style={styles.center}>
                <Text style={styles.text}>
                    Commander
                </Text>
            </View>
        
            
        </View>
        
        
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#25292e',
        justifyContent: 'center',
        alignItems: 'center',
      },
    center: {
        flex:1,
        justifyContent: 'center',
        alignItems: 'center'

    },
    text: {
        color:'white',
    }
})