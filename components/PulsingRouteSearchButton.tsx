import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';

type Props = {
  loading: boolean;
  onPress: () => void;
  disabled: boolean;
  style: ViewStyle | ViewStyle[] | (ViewStyle | undefined | null | false)[];
  textStyle: TextStyle;
  idleLabel?: string;
  loadingLabel?: string;
  /** `spinner`: indicador + texto. `idle-muted`: mantém o rótulo normal com o estilo “desativado” (use com barra de progresso no header). */
  loadingMode?: 'spinner' | 'idle-muted';
  activeOpacity?: number;
};

/**
 * Carregamento: por padrão ActivityIndicator + texto; em `idle-muted` só o rótulo (visual desativado vem do estilo pai).
 */
export function PulsingRouteSearchButton({
  loading,
  onPress,
  disabled,
  style,
  textStyle,
  idleLabel = 'Buscar rotas',
  loadingLabel = 'Buscando rotas',
  loadingMode = 'spinner',
  activeOpacity = 0.85,
}: Props) {
  const showMutedIdle = loading && loadingMode === 'idle-muted';

  return (
    <TouchableOpacity
      style={style}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={activeOpacity}
    >
      {loading && !showMutedIdle ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={textStyle}>{loadingLabel}</Text>
        </View>
      ) : (
        <Text style={textStyle}>{idleLabel}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
});
