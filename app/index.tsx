import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { login, register } from '../services/auth.service';
import { saveToken, saveUserAvatar, saveUserInfo } from '../services/token.service';
import WomanAvatarIllustration from '../assets/images/undraw_a-woman-avatar_ifsl.svg';

const SCREEN_H = Dimensions.get('window').height;
const MENU_MARGIN = 12;
const ROW_H = 52;
const PRIMARY = '#0057A8';

type DisabilityType = 'visual' | 'wheelchair' | 'reduced_mobility' | '';
type MenuKind = 'group';

const DISABILITY_OPTIONS = [
  { label: 'Deficiencia Visual', value: 'visual' as const, icon: 'eye-off' as const },
  { label: 'Cadeirante', value: 'wheelchair' as const, icon: 'wheelchair-accessibility' as const },
  { label: 'Mobilidade Reduzida', value: 'reduced_mobility' as const, icon: 'walk' as const },
];

type MenuAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  listHeight: number;
  scroll: boolean;
};

function computeMenuPlacement(
  y: number,
  h: number,
  itemCount: number,
  preferUp: boolean,
): { top: number; listHeight: number; scroll: boolean } {
  const fullH = itemCount * ROW_H;
  const spaceBelow = SCREEN_H - y - h - MENU_MARGIN;
  const spaceAbove = y - MENU_MARGIN;

  /** Menu no fim do formul?rio: prioriza abrir para cima (mais espa?o ?til). */
  if (preferUp) {
    if (spaceAbove >= fullH) {
      return { top: y - fullH, listHeight: fullH, scroll: false };
    }
    if (spaceAbove >= ROW_H) {
      const listHeight = Math.max(ROW_H, Math.min(fullH, Math.floor(spaceAbove - 4)));
      return { top: y - listHeight, listHeight, scroll: listHeight < fullH };
    }
    if (spaceBelow >= fullH) {
      return { top: y + h, listHeight: fullH, scroll: false };
    }
    const listHeight = Math.max(ROW_H, Math.min(fullH, Math.floor(spaceBelow)));
    return { top: y + h, listHeight, scroll: listHeight < fullH };
  }

  const fitsBelow = spaceBelow >= fullH;
  if (fitsBelow) {
    return { top: y + h, listHeight: fullH, scroll: false };
  }

  const fitsAbove = spaceAbove >= fullH;
  if (fitsAbove) {
    return { top: y - fullH, listHeight: fullH, scroll: false };
  }

  if (spaceAbove >= spaceBelow) {
    const listHeight = Math.max(ROW_H, Math.min(fullH, Math.floor(spaceAbove - 4)));
    return { top: y - listHeight, listHeight, scroll: listHeight < fullH };
  }

  const listHeight = Math.max(ROW_H, Math.min(fullH, Math.floor(spaceBelow)));
  return { top: y + h, listHeight, scroll: listHeight < fullH };
}

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const formScrollRef = useRef<ScrollView>(null);
  const groupRef = useRef<View>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [disabilityType, setDisabilityType] = useState<DisabilityType>('');
  const [loading, setLoading] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [showAvatarAccessModal, setShowAvatarAccessModal] = useState(false);

  const [menu, setMenu] = useState<MenuKind | null>(null);
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);

  const closeMenu = useCallback(() => {
    setMenu(null);
    setAnchor(null);
  }, []);

  const openMenu = useCallback(
    (kind: MenuKind, ref: React.RefObject<View | null>) => {
      if (menu === kind) {
        closeMenu();
        return;
      }
      ref.current?.measureInWindow((x, y, width, height) => {
        const count = DISABILITY_OPTIONS.length;
        const preferUp = false;
        const { top, listHeight, scroll } = computeMenuPlacement(y, height, count, preferUp);
        setAnchor({
          x,
          y,
          width,
          height,
          top,
          listHeight,
          scroll,
        });
        setMenu(kind);
      });
    },
    [menu, closeMenu],
  );

  const disabilityLabel =
    DISABILITY_OPTIONS.find((o) => o.value === disabilityType)?.label ?? null;
  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === password;

  const ensurePasswordVisible = useCallback(() => {
    setTimeout(() => {
      formScrollRef.current?.scrollTo({ y: 300, animated: true });
    }, 120);
  }, []);

  const handleSubmit = async () => {
    if (!name || !email || !password || !disabilityType || !passwordsMatch) {
      Alert.alert('Atencao', 'Preencha nome, email, senha, confirme a senha e grupo.');
      return;
    }

    try {
      setLoading(true);
      await register(name, email, password, disabilityType);
      const loginData = await login(email, password);
      await saveToken(loginData.access_token);
      await saveUserInfo(loginData.user_id, loginData.name, email);
      await saveUserAvatar(avatarUri ?? undefined);
      router.push('/email-confirmation');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Nao foi possivel concluir o cadastro. Tente novamente.';
      Alert.alert('Erro', message);
    } finally {
      setLoading(false);
    }
  };

  const pickAvatarImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setAvatarUri(result.assets[0].uri);
  };

  const handlePickAvatar = async (mode: 'full' | 'limited') => {
    try {
      setShowAvatarAccessModal(false);

      if (mode === 'limited' && Platform.OS === 'ios') {
        const current = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (!current.granted) {
          const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!req.granted) {
            Alert.alert('Permissão necessária', 'Permita acesso às fotos para alterar o avatar.');
            return;
          }
        }
        await pickAvatarImage();
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permissão necessária', 'Permita acesso às fotos para alterar o avatar.');
        return;
      }
      await pickAvatarImage();
    } catch {
      Alert.alert('Erro', 'Não foi possível selecionar a imagem.');
    }
  };

  const renderMenuRows = (
    options: typeof DISABILITY_OPTIONS,
    selected: string,
    onPick: (value: DisabilityType) => void,
  ) => {
    const body = options.map((option, index) => {
      const isSelected = selected === option.value;
      const isLast = index === options.length - 1;
      return (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.menuRow,
            !isLast && styles.menuRowBorder,
            isSelected && styles.menuRowSelected,
          ]}
          onPress={() => {
            onPick(option.value);
            closeMenu();
          }}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons name={option.icon} size={20} color="#0057A8" />
          <Text style={[styles.menuRowText, isSelected && styles.menuRowTextSelected]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      );
    });

    if (!anchor) return null;

    if (anchor.scroll) {
      return (
        <ScrollView
          style={{ maxHeight: anchor.listHeight }}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {body}
        </ScrollView>
      );
    }

    return <View>{body}</View>;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <ScrollView
        ref={formScrollRef}
        style={styles.formScroll}
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push('/login')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={PRIMARY} />
        </TouchableOpacity>

        <View style={styles.avatarWrap}>
          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={() => setShowAvatarAccessModal(true)}
            activeOpacity={0.85}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <WomanAvatarIllustration width={80} height={80} />
            )}
            <View style={styles.editBadge}>
              <MaterialCommunityIcons name="pencil" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Nome</Text>
        <TextInput
          style={styles.input}
          placeholder="Seu nome"
          placeholderTextColor="#AAAAAA"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="seu@email.com"
          placeholderTextColor="#AAAAAA"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Senha</Text>
        <View style={styles.inputWithIcon}>
          <TextInput
            style={styles.inputPassword}
            placeholder="Minimo 6 caracteres"
            placeholderTextColor="#AAAAAA"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            onFocus={ensurePasswordVisible}
          />
          <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
            <MaterialCommunityIcons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#AAAAAA"
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Confirmar senha</Text>
        <View style={styles.inputWithIcon}>
          <TextInput
            style={styles.inputPassword}
            placeholder="Confirme sua senha"
            placeholderTextColor="#AAAAAA"
            secureTextEntry={!showConfirmPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            onFocus={ensurePasswordVisible}
          />
          {passwordsMatch ? (
            <MaterialCommunityIcons
              name="check-circle"
              size={20}
              color="#22c55e"
              style={styles.passwordCheckIcon}
            />
          ) : null}
          <TouchableOpacity onPress={() => setShowConfirmPassword((prev) => !prev)}>
            <MaterialCommunityIcons
              name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#AAAAAA"
            />
          </TouchableOpacity>
        </View>
        {!passwordsMatch && confirmPassword.length > 0 ? (
          <Text style={styles.passwordMismatchText}>As senhas não coincidem</Text>
        ) : null}

        <Text style={styles.label}>A que grupo voce pertence?</Text>
        <View ref={groupRef} collapsable={false}>
          <TouchableOpacity
            style={[
              styles.selectBox,
              !!disabilityType && styles.selectBoxHasValue,
              menu === 'group' && styles.selectBoxFocused,
            ]}
            onPress={() => openMenu('group', groupRef)}
            activeOpacity={0.8}
          >
            <View style={styles.selectBoxLeft}>
              {disabilityType ? (
                <>
                  <MaterialCommunityIcons
                    name={
                      DISABILITY_OPTIONS.find((o) => o.value === disabilityType)?.icon ??
                      'help-circle-outline'
                    }
                    size={20}
                    color="#0057A8"
                  />
                  <Text style={[styles.selectBoxValue, styles.selectBoxValueBlue]}>
                    {disabilityLabel}
                  </Text>
                </>
              ) : (
                <Text style={styles.selectPlaceholder}>Selecione</Text>
              )}
            </View>
            <MaterialCommunityIcons
              name={menu === 'group' ? 'chevron-up' : 'chevron-down'}
              size={22}
              color="#AAAAAA"
            />
          </TouchableOpacity>
        </View>
        <View style={styles.fieldSpacer} />

        <TouchableOpacity
          style={[
            styles.continueButton,
            (!passwordsMatch || loading) && styles.continueButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={loading || !passwordsMatch}
        >
          <Text style={styles.continueText}>{loading ? 'Carregando...' : 'Continue'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={menu !== null && anchor !== null} transparent animationType="fade">
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
          {anchor && menu ? (
            <View
              style={[
                styles.menuPanel,
                {
                  left: anchor.x,
                  width: anchor.width,
                  top: anchor.top,
                  maxHeight: anchor.listHeight,
                },
              ]}
              pointerEvents="box-none"
            >
              {menu === 'group'
                ? renderMenuRows(DISABILITY_OPTIONS, disabilityType, (v) =>
                    setDisabilityType(v as DisabilityType),
                  )
                : null}
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal visible={showAvatarAccessModal} transparent animationType="fade">
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowAvatarAccessModal(false)} />
          <View style={styles.avatarAccessPanel}>
            <Text style={styles.avatarAccessTitle}>Permitir acesso à galeria?</Text>
            <Text style={styles.avatarAccessSubtitle}>
              Escolha como deseja liberar o acesso para trocar seu avatar.
            </Text>
            <TouchableOpacity
              style={styles.avatarAccessPrimaryBtn}
              activeOpacity={0.85}
              onPress={() => handlePickAvatar('full')}
            >
              <Text style={styles.avatarAccessPrimaryText}>Permitir tudo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatarAccessSecondaryBtn}
              activeOpacity={0.85}
              onPress={() => handlePickAvatar('limited')}
            >
              <Text style={styles.avatarAccessSecondaryText}>Permitir de forma restrita</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShowAvatarAccessModal(false)}
            >
              <Text style={styles.avatarAccessCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  formScroll: {
    flex: 1,
  },
  form: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    paddingVertical: 4,
    paddingRight: 8,
  },
  avatarWrap: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D9D9D9',
    position: 'relative',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  editBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0057A8',
    position: 'absolute',
    right: -2,
    bottom: -2,
    zIndex: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  label: {
    color: '#1E1D1D',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    fontFamily: 'Agrandir-TextBold',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 8,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1E1D1D',
    marginBottom: 16,
    fontFamily: 'Agrandir-Regular',
  },
  inputWithIcon: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 8,
    height: 52,
    paddingHorizontal: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputPassword: {
    flex: 1,
    color: '#1E1D1D',
    fontSize: 14,
    fontFamily: 'Agrandir-Regular',
  },
  selectBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 8,
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectBoxHasValue: {
    borderColor: PRIMARY,
    backgroundColor: '#EBF3FF',
  },
  selectBoxFocused: {
    borderColor: PRIMARY,
  },
  selectBoxLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectPlaceholder: {
    color: '#AAAAAA',
    fontSize: 14,
    fontFamily: 'Agrandir-Regular',
  },
  selectBoxValue: {
    fontSize: 14,
    marginLeft: 12,
    fontFamily: 'Agrandir-Regular',
  },
  selectBoxValueBlue: {
    color: '#0057A8',
    fontWeight: '600',
  },
  fieldSpacer: {
    height: 16,
  },
  continueButton: {
    backgroundColor: PRIMARY,
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 40,
    height: 52,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  passwordCheckIcon: {
    marginRight: 8,
  },
  passwordMismatchText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 12,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Agrandir-Regular',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  menuPanel: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PRIMARY,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  menuRow: {
    height: ROW_H,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  menuRowSelected: {
    backgroundColor: '#EBF3FF',
  },
  menuRowText: {
    color: '#1E1D1D',
    fontSize: 14,
    marginLeft: 12,
    fontFamily: 'Agrandir-Regular',
  },
  menuRowTextSelected: {
    color: '#0057A8',
    fontWeight: '600',
  },
  avatarAccessPanel: {
    marginTop: 'auto',
    marginHorizontal: 16,
    marginBottom: 'auto',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  avatarAccessTitle: {
    color: '#1E1D1D',
    fontSize: 16,
    fontFamily: 'Agrandir-TextBold',
  },
  avatarAccessSubtitle: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Agrandir-Regular',
  },
  avatarAccessPrimaryBtn: {
    height: 44,
    borderRadius: 999,
    backgroundColor: '#0057A8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  avatarAccessPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Agrandir-TextBold',
  },
  avatarAccessSecondaryBtn: {
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#0057A8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAccessSecondaryText: {
    color: '#0057A8',
    fontSize: 14,
    fontFamily: 'Agrandir-TextBold',
  },
  avatarAccessCancelText: {
    color: '#6B7280',
    textAlign: 'center',
    fontSize: 13,
    marginTop: 2,
    fontFamily: 'Agrandir-Regular',
  },
});
