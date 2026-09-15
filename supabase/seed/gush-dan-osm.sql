-- gush-dan-osm.sql — СГЕНЕРИРОВАНО scripts/import-osm.ts (не редактировать вручную).
-- Источник: OpenStreetMap / Overpass API. BBOX (S,W,N,E) = 31.93,34.72,32.2,34.86.
-- Применять в Supabase SQL Editor (роль postgres → auth.uid() IS NULL → триггер пропускает).
-- Кол-во: water_sources=835 (dedup по osm_id на стороне БД), park=556, dog_park=255.

BEGIN;

-- water_sources (835 кандидатов; существующие 109 пропустятся по ON CONFLICT)
INSERT INTO public.water_sources (osm_id, lat, lng, amenity, dog_bowl) VALUES
  ('node/735827259', 32.0616802, 34.7598944, 'drinking_water', false),
  ('node/741634321', 31.9342229, 34.799904, 'drinking_water', false),
  ('node/951616438', 32.1027053, 34.7973419, 'drinking_water', false),
  ('node/954182422', 32.1010313, 34.7944757, 'drinking_water', false),
  ('node/954393830', 32.1011442, 34.7951249, 'drinking_water', false),
  ('node/962968443', 32.096555, 34.8110765, 'drinking_water', false),
  ('node/962968446', 32.1164541, 34.7813715, 'drinking_water', false),
  ('node/962968448', 32.1074139, 34.841134, 'drinking_water', false),
  ('node/962968449', 32.1085885, 34.8438214, 'drinking_water', false),
  ('node/965135395', 32.0982436, 34.8185415, 'drinking_water', false),
  ('node/965157772', 32.107886, 34.777095, 'drinking_water', false),
  ('node/965157775', 32.1001446, 34.8054419, 'drinking_water', false),
  ('node/965157798', 32.104096, 34.7767711, 'drinking_water', false),
  ('node/965157805', 32.0962544, 34.7867275, 'drinking_water', false),
  ('node/968701688', 32.0910363, 34.7707685, 'drinking_water', false),
  ('node/968701778', 32.0904073, 34.7711037, 'drinking_water', false),
  ('node/979309476', 32.1146037, 34.7896963, 'drinking_water', false),
  ('node/979309496', 32.1061071, 34.8256099, 'drinking_water', false),
  ('node/1031301894', 32.0998031, 34.8001499, 'drinking_water', false),
  ('node/1031301915', 32.1140049, 34.7802566, 'drinking_water', false),
  ('node/1102280988', 32.1211726, 34.8202172, 'drinking_water', false),
  ('node/1102282781', 32.123041, 34.8225172, 'drinking_water', false),
  ('node/1102288679', 32.1225024, 34.8197626, 'drinking_water', false),
  ('node/1105342185', 32.0993626, 34.8032042, 'drinking_water', false),
  ('node/1105345188', 32.0958613, 34.7846117, 'drinking_water', false),
  ('node/1107311412', 32.1555361, 34.8444977, 'drinking_water', false),
  ('node/1164290714', 32.118749, 34.8227882, 'drinking_water', false),
  ('node/1164641850', 32.1211817, 34.814932, 'drinking_water', false),
  ('node/1170452257', 32.118161, 34.8292402, 'drinking_water', false),
  ('node/1171649138', 32.116271, 34.8357625, 'drinking_water', false),
  ('node/1192723783', 32.1266294, 34.8281526, 'drinking_water', false),
  ('node/1198058473', 32.0553314, 34.7541974, 'drinking_water', false),
  ('node/1198058485', 32.0555997, 34.7534625, 'drinking_water', false),
  ('node/1198950728', 32.053749, 34.7514134, 'drinking_water', false),
  ('node/1198961221', 32.0549649, 34.7542665, 'drinking_water', false),
  ('node/1200567543', 32.120299, 34.8223537, 'drinking_water', false),
  ('node/1200673890', 32.1178166, 34.8286845, 'drinking_water', false),
  ('node/1212536200', 32.1101557, 34.8296654, 'drinking_water', false),
  ('node/1312275342', 32.0581866, 34.8066009, 'drinking_water', false),
  ('node/1312275344', 32.0590319, 34.8071152, 'drinking_water', false),
  ('node/1372897101', 32.1770502, 34.8115054, 'drinking_water', false),
  ('node/1378775901', 32.0222452, 34.7419848, 'drinking_water', false),
  ('node/1504180255', 32.0233615, 34.7665067, 'drinking_water', false),
  ('node/1620073733', 32.1625704, 34.8079129, 'drinking_water', false),
  ('node/1686208706', 32.0811795, 34.799548, 'drinking_water', false),
  ('node/1716547577', 32.0285187, 34.7599194, 'drinking_water', false),
  ('node/1716547821', 32.0316648, 34.7592828, 'drinking_water', false),
  ('node/1716729255', 32.0295174, 34.7418481, 'drinking_water', false),
  ('node/1736746030', 32.013441, 34.7607222, 'drinking_water', false),
  ('node/1743699307', 31.9962166, 34.7668425, 'drinking_water', false),
  ('node/1743699378', 31.9964504, 34.76812, 'drinking_water', false),
  ('node/1743699429', 31.9969933, 34.7677023, 'drinking_water', false),
  ('node/1747121168', 32.1003941, 34.7783911, 'drinking_water', false),
  ('node/1747121223', 32.119607, 34.7823078, 'drinking_water', false),
  ('node/1747121246', 32.1218501, 34.7832052, 'drinking_water', false),
  ('node/1757673336', 32.1290347, 34.7921793, 'drinking_water', false),
  ('node/1757673343', 32.129277, 34.7917857, 'drinking_water', false),
  ('node/1757673380', 32.1297845, 34.7917371, 'drinking_water', false),
  ('node/1758968567', 32.0170034, 34.7570123, 'drinking_water', false),
  ('node/1758968663', 32.0199523, 34.7595233, 'drinking_water', false),
  ('node/1758968775', 32.0211196, 34.7588336, 'drinking_water', false),
  ('node/1761616581', 32.0137877, 34.7527465, 'drinking_water', false),
  ('node/1763557120', 32.0233669, 34.7638419, 'drinking_water', false),
  ('node/1766061820', 32.0110823, 34.7641208, 'drinking_water', false),
  ('node/1766061878', 32.0123144, 34.764147, 'drinking_water', false),
  ('node/1766488427', 32.0076767, 34.7637174, 'drinking_water', false),
  ('node/1766889556', 32.0033337, 34.7651559, 'drinking_water', false),
  ('node/1766961712', 32.0040626, 34.7671807, 'drinking_water', false),
  ('node/1777324611', 32.0233191, 34.7689749, 'drinking_water', false),
  ('node/1777324612', 32.0233238, 34.7684828, 'drinking_water', false),
  ('node/1933709156', 32.0399293, 34.7762367, 'drinking_water', false),
  ('node/1933709181', 32.0415813, 34.7736725, 'drinking_water', false),
  ('node/1937276758', 32.0223145, 34.7388904, 'drinking_water', false),
  ('node/1949629962', 32.0068364, 34.793957, 'drinking_water', false),
  ('node/1961611887', 31.9785174, 34.7643387, 'drinking_water', false),
  ('node/1961611929', 31.9796627, 34.7578152, 'drinking_water', false),
  ('node/1961611986', 31.9793621, 34.7580459, 'drinking_water', false),
  ('node/1961612153', 31.9843375, 34.7577605, 'drinking_water', false),
  ('node/1961612388', 31.9860254, 34.7607417, 'drinking_water', false),
  ('node/1968967459', 32.007933, 34.7805724, 'drinking_water', false),
  ('node/1980145848', 32.0063855, 34.771725, 'drinking_water', false),
  ('node/1980146036', 32.0079378, 34.7829449, 'drinking_water', false),
  ('node/1980146075', 32.0082308, 34.7827212, 'drinking_water', false),
  ('node/2009052940', 32.0212737, 34.7731276, 'drinking_water', false),
  ('node/2089193605', 32.1282245, 34.8319761, 'drinking_water', false),
  ('node/2123589655', 32.0195991, 34.7660481, 'drinking_water', false),
  ('node/2228886556', 32.1213124, 34.8190889, 'drinking_water', false),
  ('node/2322545055', 32.0954797, 34.8133568, 'drinking_water', false),
  ('node/2322558011', 32.1039395, 34.8227624, 'drinking_water', false),
  ('node/2379355318', 32.0930353, 34.8182722, 'drinking_water', false),
  ('node/2412517170', 32.042211, 34.7919644, 'drinking_water', false),
  ('node/2412517171', 32.0433821, 34.8045341, 'drinking_water', false),
  ('node/2424813498', 32.0333194, 34.7680162, 'drinking_water', false),
  ('node/2424813521', 32.0340806, 34.7641384, 'drinking_water', false),
  ('node/2429428765', 31.9627511, 34.8042229, 'drinking_water', false),
  ('node/2449275606', 32.0236118, 34.7753174, 'drinking_water', false),
  ('node/2479486651', 32.037801, 34.759001, 'drinking_water', false),
  ('node/2479486653', 32.0378012, 34.7580728, 'drinking_water', false),
  ('node/2479486724', 32.0384987, 34.7571332, 'drinking_water', false),
  ('node/2498111814', 31.9990284, 34.7659641, 'drinking_water', false),
  ('node/2547042557', 32.0927946, 34.8203738, 'drinking_water', false),
  ('node/2577660835', 32.1074524, 34.7899044, 'drinking_water', false),
  ('node/2669725291', 32.0432168, 34.8037411, 'drinking_water', false),
  ('node/2807972447', 32.1115865, 34.8039427, 'drinking_water', false),
  ('node/2868133701', 32.1608091, 34.8102004, 'drinking_water', false),
  ('node/2869160254', 32.0496282, 34.7605182, 'drinking_water', false),
  ('node/2931878496', 32.0375611, 34.7673108, 'drinking_water', false),
  ('node/2931878950', 32.0444626, 34.7607718, 'drinking_water', false),
  ('node/2946536439', 32.031401, 34.7486757, 'drinking_water', false),
  ('node/2946536440', 32.0317494, 34.7483029, 'drinking_water', false),
  ('node/3064419407', 32.193812, 34.8486031, 'drinking_water', false),
  ('node/3064419408', 32.1969337, 34.8496186, 'drinking_water', false),
  ('node/3064419409', 32.1954139, 34.8523191, 'drinking_water', false),
  ('node/3064419410', 32.1965918, 34.8540996, 'drinking_water', false),
  ('node/3073581647', 32.1346816, 34.835283, 'drinking_water', false),
  ('node/3073582590', 32.1269158, 34.8037073, 'drinking_water', false),
  ('node/3110760216', 31.9450163, 34.7752509, 'drinking_water', false),
  ('node/3111568353', 32.1794816, 34.8594696, 'drinking_water', false),
  ('node/3111568354', 32.1803965, 34.8577221, 'drinking_water', false),
  ('node/3111568355', 32.1769741, 34.8405078, 'drinking_water', false),
  ('node/3281864544', 32.0194976, 34.7671372, 'drinking_water', false),
  ('node/3416715754', 32.0427182, 34.8027967, 'drinking_water', false),
  ('node/3417314206', 32.0432208, 34.8017125, 'drinking_water', false),
  ('node/3417352545', 32.0423165, 34.804614, 'drinking_water', false),
  ('node/3417384591', 32.0400323, 34.8025058, 'drinking_water', false),
  ('node/3417393025', 32.0410286, 34.8014368, 'drinking_water', false),
  ('node/3418431646', 32.0426994, 34.792606, 'drinking_water', false),
  ('node/3418431647', 32.0426963, 34.791895, 'drinking_water', false),
  ('node/3418521493', 32.0425247, 34.8007626, 'drinking_water', false),
  ('node/3442546695', 32.0420002, 34.8005928, 'drinking_water', false),
  ('node/3442590904', 32.0971336, 34.7771228, 'drinking_water', false),
  ('node/3450026515', 32.0932145, 34.7773787, 'drinking_water', false),
  ('node/3450026524', 32.0932703, 34.7713034, 'drinking_water', false),
  ('node/3451158816', 32.0994076, 34.7771038, 'drinking_water', false),
  ('node/3451158817', 32.1026274, 34.7776859, 'drinking_water', false),
  ('node/3451158819', 32.0986584, 34.7899507, 'drinking_water', false),
  ('node/3451158820', 32.0973755, 34.7892961, 'drinking_water', false),
  ('node/3451158821', 32.0967523, 34.7864796, 'drinking_water', false),
  ('node/3451158822', 32.0978491, 34.7893361, 'drinking_water', false),
  ('node/3469096205', 32.1043804, 34.7922071, 'drinking_water', false),
  ('node/3469096206', 32.103129, 34.7931022, 'drinking_water', false),
  ('node/3469096207', 32.1122614, 34.7921853, 'drinking_water', false),
  ('node/3469096211', 32.1106682, 34.8167263, 'drinking_water', false),
  ('node/3469096212', 32.1110566, 34.8168391, 'drinking_water', false),
  ('node/3469096214', 32.1061075, 34.8272216, 'drinking_water', false),
  ('node/3483693859', 32.0911121, 34.7866252, 'drinking_water', false),
  ('node/3483693860', 32.0911365, 34.7869349, 'drinking_water', false),
  ('node/3483693864', 32.0982951, 34.7856933, 'drinking_water', false),
  ('node/3493130421', 32.0994956, 34.7768561, 'drinking_water', false),
  ('node/3493130430', 32.0797555, 34.7879626, 'drinking_water', false),
  ('node/3501356983', 32.0924162, 34.7762193, 'drinking_water', false),
  ('node/3501356984', 32.0980004, 34.7798408, 'drinking_water', false),
  ('node/3505925369', 32.099412, 34.783463, 'drinking_water', false),
  ('node/3511595860', 32.0982135, 34.7777338, 'drinking_water', false),
  ('node/3511595862', 32.1109117, 34.8372912, 'drinking_water', false),
  ('node/3564373597', 32.0761503, 34.7870433, 'drinking_water', false),
  ('node/3633242368', 32.0510656, 34.7494536, 'drinking_water', false),
  ('node/3666392254', 32.1238473, 34.7929649, 'drinking_water', false),
  ('node/3720462675', 32.0046577, 34.7984203, 'drinking_water', false),
  ('node/3720462696', 32.0046791, 34.79665, 'drinking_water', false),
  ('node/3720462729', 32.0047895, 34.7979554, 'drinking_water', false),
  ('node/3720462754', 32.0048855, 34.7969856, 'drinking_water', false),
  ('node/3722073795', 32.002476, 34.7949712, 'drinking_water', false),
  ('node/3773154630', 31.9551544, 34.8046255, 'drinking_water', false),
  ('node/3773154631', 31.9555126, 34.8045996, 'drinking_water', false),
  ('node/3855992020', 32.0939831, 34.8137663, 'drinking_water', false),
  ('node/3865716650', 31.9809838, 34.7575218, 'drinking_water', false),
  ('node/3915420516', 31.956815, 34.7976251, 'drinking_water', false),
  ('node/3915420541', 31.957135, 34.7952146, 'drinking_water', false),
  ('node/4097318746', 32.1065128, 34.8049305, 'drinking_water', false),
  ('node/4114965164', 31.9621569, 34.773394, 'drinking_water', false),
  ('node/4114965165', 31.9623892, 34.7731103, 'drinking_water', false),
  ('node/4178173337', 32.1630104, 34.8297544, 'drinking_water', false),
  ('node/4191089007', 32.168152, 34.8032146, 'drinking_water', false),
  ('node/4304416799', 31.9769588, 34.7716453, 'drinking_water', false),
  ('node/4347307340', 31.9380712, 34.8002854, 'drinking_water', false),
  ('node/4347307341', 31.9307568, 34.7992071, 'drinking_water', false),
  ('node/4347310597', 31.9443039, 34.8012024, 'drinking_water', false),
  ('node/4347310598', 31.9547078, 34.7981321, 'drinking_water', false),
  ('node/4347310599', 31.9523977, 34.8025588, 'drinking_water', false),
  ('node/4347310600', 31.9405589, 34.8005885, 'drinking_water', false),
  ('node/4381041590', 31.985651, 34.7587805, 'drinking_water', false),
  ('node/4382025040', 31.9702919, 34.7769807, 'drinking_water', false),
  ('node/4428541691', 32.1392991, 34.8290347, 'drinking_water', false),
  ('node/4428610391', 32.1403206, 34.8231941, 'drinking_water', false),
  ('node/4513718903', 31.9953077, 34.7478718, 'drinking_water', false),
  ('node/4513740262', 32.0050792, 34.7345151, 'drinking_water', false),
  ('node/4513740263', 32.0040226, 34.7342183, 'drinking_water', false),
  ('node/4537439226', 31.9834604, 34.7688617, 'drinking_water', false),
  ('node/4716375218', 31.9807419, 34.768488, 'drinking_water', false),
  ('node/4716375219', 31.9800234, 34.7685605, 'drinking_water', false),
  ('node/4716375220', 31.9820095, 34.7687133, 'drinking_water', false),
  ('node/4716375221', 31.9810896, 34.7682834, 'drinking_water', false),
  ('node/4756495850', 31.9597228, 34.8017377, 'drinking_water', false),
  ('node/4771259878', 31.9591522, 34.8024123, 'drinking_water', false),
  ('node/4783119606', 32.187688, 34.8481189, 'drinking_water', false),
  ('node/4783119842', 32.1870338, 34.8504991, 'drinking_water', false),
  ('node/4783119853', 32.1890926, 34.8481741, 'drinking_water', false),
  ('node/4783119871', 32.1877406, 34.8487193, 'drinking_water', false),
  ('node/4783465246', 32.1876578, 34.8474069, 'drinking_water', false),
  ('node/4785897636', 31.9775855, 34.7849314, 'drinking_water', false),
  ('node/4785897652', 31.9778624, 34.7852478, 'drinking_water', false),
  ('node/4785897653', 31.9770821, 34.7852716, 'drinking_water', false),
  ('node/4796388624', 31.9812494, 34.8045224, 'drinking_water', false),
  ('node/4796390626', 31.9813702, 34.80507, 'drinking_water', false),
  ('node/4796421191', 31.9824628, 34.8034868, 'drinking_water', false),
  ('node/4818084221', 32.1437508, 34.8263928, 'drinking_water', false),
  ('node/4818084222', 32.1447958, 34.8267929, 'drinking_water', false),
  ('node/4822338205', 31.979376, 34.7728042, 'drinking_water', false),
  ('node/4825431990', 32.1861828, 34.849418, 'drinking_water', false),
  ('node/4825431996', 32.1886525, 34.8456903, 'drinking_water', false),
  ('node/4860719644', 32.0631864, 34.8122143, 'drinking_water', false),
  ('node/4891329638', 31.962635, 34.7809563, 'drinking_water', false),
  ('node/4893423670', 31.9345048, 34.8004812, 'drinking_water', false),
  ('node/4893423673', 31.933958, 34.800647, 'drinking_water', false),
  ('node/4893995391', 31.9329824, 34.8002175, 'drinking_water', false),
  ('node/4907460012', 32.194614, 34.8538495, 'drinking_water', false),
  ('node/4907460013', 32.1943382, 34.8546944, 'drinking_water', false),
  ('node/4909063236', 31.9618798, 34.7960388, 'drinking_water', false),
  ('node/4917216912', 31.9819453, 34.7625738, 'drinking_water', false),
  ('node/4934963493', 31.9793786, 34.7695998, 'drinking_water', false),
  ('node/4975791783', 32.0845634, 34.7685583, 'drinking_water', false),
  ('node/4995061134', 32.1224477, 34.8152761, 'drinking_water', false),
  ('node/5001017432', 32.1975948, 34.8553074, 'drinking_water', false),
  ('node/5008105279', 32.1386743, 34.8464881, 'drinking_water', false),
  ('node/5101181086', 31.9651102, 34.7946065, 'drinking_water', false),
  ('node/5140708428', 32.1006065, 34.8081257, 'drinking_water', false),
  ('node/5140708429', 32.1000961, 34.8029394, 'drinking_water', false),
  ('node/5140708430', 32.100529, 34.7988996, 'drinking_water', false),
  ('node/5140708431', 32.0985322, 34.7955581, 'drinking_water', false),
  ('node/5140708435', 32.097033, 34.7812545, 'drinking_water', false),
  ('node/5140708454', 32.1006458, 34.8125782, 'drinking_water', false),
  ('node/5147910757', 31.9640138, 34.8269144, 'drinking_water', false),
  ('node/5147980796', 31.9659258, 34.8255946, 'drinking_water', false),
  ('node/5179763435', 32.1698765, 34.823956, 'drinking_water', false),
  ('node/5179763437', 32.1684289, 34.8221084, 'drinking_water', false),
  ('node/5179763439', 32.1694677, 34.8240353, 'drinking_water', false),
  ('node/5179763441', 32.1717135, 34.8248344, 'drinking_water', false),
  ('node/5179763444', 32.1694597, 34.8225247, 'drinking_water', false),
  ('node/5179763456', 32.1691304, 34.8238093, 'drinking_water', false),
  ('node/5179763460', 32.1700064, 34.82327, 'drinking_water', false),
  ('node/5179763462', 32.1689907, 34.8234318, 'drinking_water', false),
  ('node/5179763463', 32.1694457, 34.8223758, 'drinking_water', false),
  ('node/5183999995', 32.1443857, 34.839143, 'drinking_water', false),
  ('node/5223262957', 32.0335863, 34.8189087, 'drinking_water', false),
  ('node/5223262958', 32.0303495, 34.8209017, 'drinking_water', false),
  ('node/5223262959', 32.0305531, 34.8203125, 'drinking_water', false),
  ('node/5223494994', 31.9609736, 34.7730199, 'drinking_water', false),
  ('node/5234384268', 31.9669749, 34.7837342, 'drinking_water', false),
  ('node/5245312055', 31.9616182, 34.7799136, 'drinking_water', false),
  ('node/5245312081', 31.9609732, 34.7778886, 'drinking_water', false),
  ('node/5246140224', 32.0999308, 34.7738517, 'drinking_water', false),
  ('node/5252342869', 31.9639599, 34.7993572, 'drinking_water', false),
  ('node/5280014512', 31.9603607, 34.7874512, 'drinking_water', false),
  ('node/5298906519', 31.9617885, 34.7749973, 'drinking_water', false),
  ('node/5298932240', 31.969482, 34.7911655, 'drinking_water', false),
  ('node/5300658532', 31.9796559, 34.7650394, 'drinking_water', false),
  ('node/5312109022', 32.0304181, 34.7502545, 'drinking_water', false),
  ('node/5350960121', 31.9812602, 34.7575375, 'drinking_water', false),
  ('node/5350960123', 31.982591, 34.7576166, 'drinking_water', false),
  ('node/5380986324', 32.002447, 34.7336319, 'drinking_water', false),
  ('node/5382625811', 31.9762276, 34.7722351, 'drinking_water', false),
  ('node/5382625814', 31.982276, 34.7695317, 'drinking_water', false),
  ('node/5393498806', 31.9592207, 34.7938788, 'drinking_water', false),
  ('node/5393502723', 31.9613379, 34.7938031, 'drinking_water', false),
  ('node/5393502728', 31.9585531, 34.7937311, 'drinking_water', false),
  ('node/5393502729', 31.9597422, 34.7937639, 'drinking_water', false),
  ('node/5412493112', 31.9664205, 34.7749573, 'drinking_water', false),
  ('node/5412493120', 31.9649217, 34.7723233, 'drinking_water', false),
  ('node/5412493325', 31.9672092, 34.7765162, 'drinking_water', false),
  ('node/5412493328', 31.9640009, 34.7725726, 'drinking_water', false),
  ('node/5424870119', 31.9581037, 34.790979, 'drinking_water', false),
  ('node/5426766962', 31.9639999, 34.773615, 'drinking_water', false),
  ('node/5426766966', 31.9671082, 34.7724943, 'drinking_water', false),
  ('node/5426766983', 31.9656076, 34.7757954, 'drinking_water', false),
  ('node/5445913229', 31.9782651, 34.7830784, 'drinking_water', false),
  ('node/5445913230', 31.9778235, 34.7820248, 'drinking_water', false),
  ('node/5445913231', 31.9775183, 34.7806707, 'drinking_water', false),
  ('node/5445997376', 31.9773063, 34.7805895, 'drinking_water', false),
  ('node/5469374936', 32.170535, 34.8232085, 'drinking_water', false),
  ('node/5469374940', 32.1697682, 34.8219296, 'drinking_water', false),
  ('node/5469374941', 32.1687405, 34.8227813, 'drinking_water', false),
  ('node/5501827920', 32.1000768, 34.7739704, 'drinking_water', false),
  ('node/5501828122', 32.1002639, 34.7760163, 'drinking_water', false),
  ('node/5531069111', 32.186218, 34.8524954, 'drinking_water', false),
  ('node/5531069117', 32.1871811, 34.8499705, 'drinking_water', false),
  ('node/5531069120', 32.187247, 34.8487944, 'drinking_water', false),
  ('node/5531069624', 32.1868425, 34.8494991, 'drinking_water', false),
  ('node/5531069635', 32.1887798, 34.8466864, 'drinking_water', false),
  ('node/5538090848', 32.1061578, 34.8304891, 'drinking_water', false),
  ('node/5550559549', 31.9774929, 34.761281, 'drinking_water', false),
  ('node/5574560078', 31.9829641, 34.7689047, 'drinking_water', false),
  ('node/5584039386', 31.9767413, 34.7727699, 'drinking_water', false),
  ('node/5584052088', 31.9807759, 34.7742021, 'drinking_water', false),
  ('node/5584599027', 32.0025306, 34.7346555, 'drinking_water', false),
  ('node/5584599028', 32.0017754, 34.7344876, 'drinking_water', false),
  ('node/5584599031', 32.0022548, 34.7345463, 'drinking_water', false),
  ('node/5584599032', 32.0019419, 34.7348724, 'drinking_water', false),
  ('node/5596938439', 32.0610545, 34.7943118, 'drinking_water', false),
  ('node/5596938440', 32.0609282, 34.7931729, 'drinking_water', false),
  ('node/5596938443', 32.064065, 34.7923365, 'drinking_water', false),
  ('node/5596938444', 32.0613489, 34.7895569, 'drinking_water', false),
  ('node/5601781246', 32.0493131, 34.7876062, 'drinking_water', false),
  ('node/5657037478', 32.0506908, 34.8233805, 'drinking_water', false),
  ('node/5695849025', 32.040328, 34.8153995, 'drinking_water', false),
  ('node/5695855717', 32.0400739, 34.8139573, 'drinking_water', false),
  ('node/5710700120', 31.9840778, 34.7669263, 'drinking_water', false),
  ('node/5727297655', 31.9601863, 34.7735012, 'drinking_water', false),
  ('node/5730083329', 31.9750801, 34.7675322, 'drinking_water', false),
  ('node/5730083358', 31.9765474, 34.7670673, 'drinking_water', false),
  ('node/5730083390', 31.9752807, 34.7698387, 'drinking_water', false),
  ('node/5745633277', 31.9833478, 34.7577197, 'drinking_water', false),
  ('node/5760016719', 31.9808071, 34.766037, 'drinking_water', false),
  ('node/5760016788', 31.9807809, 34.7761163, 'drinking_water', false),
  ('node/5766577963', 32.0635608, 34.7927894, 'drinking_water', false),
  ('node/5766600814', 32.0619688, 34.7970334, 'drinking_water', false),
  ('node/5766600829', 32.055333, 34.796358, 'drinking_water', false),
  ('node/5766607710', 32.0669335, 34.796267, 'drinking_water', false),
  ('node/5776890098', 31.9394673, 34.7930092, 'drinking_water', false),
  ('node/5776890099', 31.939459, 34.7940292, 'drinking_water', false),
  ('node/5776890100', 31.9409723, 34.7936177, 'drinking_water', false),
  ('node/5812780925', 31.9606833, 34.7971171, 'drinking_water', false),
  ('node/5909780138', 32.1937494, 34.8204857, 'drinking_water', false),
  ('node/5913598229', 31.9649398, 34.8260513, 'drinking_water', false),
  ('node/5953025285', 32.0072577, 34.7925578, 'drinking_water', false),
  ('node/5961499713', 32.0654883, 34.7619933, 'drinking_water', false),
  ('node/5965642185', 32.0152063, 34.7833008, 'drinking_water', false),
  ('node/5997193038', 31.9799257, 34.7841628, 'drinking_water', false),
  ('node/6002343844', 31.9679744, 34.7808354, 'drinking_water', false),
  ('node/6017560686', 32.0058655, 34.7345107, 'drinking_water', false),
  ('node/6017560690', 32.0000493, 34.7329475, 'drinking_water', false),
  ('node/6024560104', 32.1100449, 34.8073312, 'drinking_water', false),
  ('node/6024876099', 32.0960415, 34.7847863, 'drinking_water', false),
  ('node/6045607529', 31.9818653, 34.8063268, 'drinking_water', false),
  ('node/6045607535', 31.9814654, 34.8061696, 'drinking_water', false),
  ('node/6049327632', 32.0719614, 34.8299022, 'drinking_water', false),
  ('node/6050892545', 32.0778124, 34.7840849, 'drinking_water', false),
  ('node/6050892895', 32.0779253, 34.7850499, 'drinking_water', false),
  ('node/6050892921', 32.0783037, 34.7863322, 'drinking_water', false),
  ('node/6087851787', 31.9811444, 34.7626645, 'drinking_water', false),
  ('node/6131236221', 31.96075, 34.7993991, 'drinking_water', false),
  ('node/6137379677', 32.1102709, 34.8143818, 'drinking_water', false),
  ('node/6138861837', 31.9651109, 34.8261277, 'drinking_water', false),
  ('node/6147743131', 32.0925109, 34.814652, 'drinking_water', false),
  ('node/6159356529', 31.971974, 34.7838745, 'drinking_water', false),
  ('node/6171641686', 31.9897494, 34.7519788, 'drinking_water', false),
  ('node/6174442096', 31.9819183, 34.764637, 'drinking_water', false),
  ('node/6185868590', 31.9748123, 34.7742103, 'drinking_water', false),
  ('node/6185868591', 31.9773994, 34.7756507, 'drinking_water', false),
  ('node/6185868593', 31.9777087, 34.7756292, 'drinking_water', false),
  ('node/6185868602', 31.9762807, 34.7748192, 'drinking_water', false),
  ('node/6218039089', 31.9715415, 34.7992619, 'drinking_water', false),
  ('node/6253531266', 31.9371218, 34.7880706, 'drinking_water', false),
  ('node/6253531268', 31.9371719, 34.788878, 'drinking_water', false),
  ('node/6258300840', 31.9720463, 34.7853353, 'drinking_water', false),
  ('node/6258300846', 31.972639, 34.7843942, 'drinking_water', false),
  ('node/6264228288', 31.9653869, 34.7784431, 'drinking_water', false),
  ('node/6264228299', 31.9673051, 34.7792537, 'drinking_water', false),
  ('node/6269687278', 32.0952758, 34.8028356, 'drinking_water', false),
  ('node/6271569897', 31.983431, 34.7766668, 'drinking_water', false),
  ('node/6271569915', 31.98025, 34.7780113, 'drinking_water', false),
  ('node/6271569964', 31.9823306, 34.7795681, 'drinking_water', false),
  ('node/6271569970', 31.9801195, 34.7786086, 'drinking_water', false),
  ('node/6280341714', 31.9689148, 34.8016712, 'drinking_water', false),
  ('node/6280341749', 31.9699606, 34.7997101, 'drinking_water', false),
  ('node/6286522599', 31.9735705, 34.7849128, 'drinking_water', false),
  ('node/6339252110', 31.9724973, 34.8046355, 'drinking_water', false),
  ('node/6339252164', 31.973845, 34.8016679, 'drinking_water', false),
  ('node/6371825546', 31.9744934, 34.7676563, 'drinking_water', false),
  ('node/6371939103', 32.0328717, 34.8197217, 'drinking_water', false),
  ('node/6371947308', 32.0332567, 34.8198667, 'drinking_water', false),
  ('node/6387957209', 31.9694496, 34.7595044, 'drinking_water', false),
  ('node/6393343602', 31.985096, 34.7749049, 'drinking_water', false),
  ('node/6419584716', 32.191247, 34.8079503, 'drinking_water', false),
  ('node/6419586599', 32.1940656, 34.8063015, 'drinking_water', false),
  ('node/6419586601', 32.1952013, 34.8068649, 'drinking_water', false),
  ('node/6419586602', 32.1945284, 34.8073358, 'drinking_water', false),
  ('node/6419586616', 32.1932787, 34.8070174, 'drinking_water', false),
  ('node/6467921093', 31.933047, 34.7868546, 'drinking_water', false),
  ('node/6467921100', 31.9308493, 34.787158, 'drinking_water', false),
  ('node/6467921101', 31.9302149, 34.7866396, 'drinking_water', false),
  ('node/6478596911', 32.1681136, 34.838637, 'drinking_water', false),
  ('node/6511283486', 32.1676978, 34.8426011, 'drinking_water', false),
  ('node/6512789863', 31.9854879, 34.7831366, 'drinking_water', false),
  ('node/6512790101', 31.9861069, 34.7833354, 'drinking_water', false),
  ('node/6512790119', 31.9858821, 34.783055, 'drinking_water', false),
  ('node/6512790147', 31.9852469, 34.7824329, 'drinking_water', false),
  ('node/6593146308', 32.0576249, 34.8145308, 'drinking_water', false),
  ('node/6618578226', 31.9570351, 34.7957204, 'drinking_water', false),
  ('node/6718140193', 31.9943634, 34.7404897, 'drinking_water', false),
  ('node/6733499586', 32.0266172, 34.7758613, 'drinking_water', false),
  ('node/6733499686', 32.0270251, 34.7776993, 'drinking_water', false),
  ('node/6741883133', 31.9756316, 34.7952548, 'drinking_water', false),
  ('node/6741890637', 31.9740109, 34.7965199, 'drinking_water', false),
  ('node/6741913627', 31.9760541, 34.794058, 'drinking_water', false),
  ('node/6741923466', 31.9760843, 34.7976034, 'drinking_water', false),
  ('node/6741923825', 31.9758189, 34.7977461, 'drinking_water', false),
  ('node/6759597437', 32.0739243, 34.7647596, 'drinking_water', false),
  ('node/6767297322', 32.0900967, 34.8146161, 'drinking_water', false),
  ('node/6776321238', 32.1118924, 34.8278106, 'drinking_water', false),
  ('node/6779382070', 31.9815341, 34.7721083, 'drinking_water', false),
  ('node/6779661392', 31.9623573, 34.7707093, 'drinking_water', false),
  ('node/6779661394', 31.9631804, 34.7695992, 'drinking_water', false),
  ('node/6779661395', 31.9616112, 34.7717183, 'drinking_water', false),
  ('node/6802372336', 32.1463065, 34.8470423, 'drinking_water', false),
  ('node/6802540683', 32.0909249, 34.7749134, 'drinking_water', false),
  ('node/6802562353', 32.1475731, 34.8473202, 'drinking_water', false),
  ('node/6810941332', 31.9845649, 34.7840942, 'drinking_water', false),
  ('node/6839850095', 32.0820567, 34.8118933, 'drinking_water', false),
  ('node/6839852663', 32.082065, 34.8129783, 'drinking_water', false),
  ('node/6839867350', 32.0818117, 34.8123317, 'drinking_water', false),
  ('node/6841589914', 32.0864076, 34.8133545, 'drinking_water', false),
  ('node/6841589940', 32.0852851, 34.8140323, 'drinking_water', false),
  ('node/6873333420', 32.072425, 34.7876883, 'drinking_water', false),
  ('node/6873366679', 32.0725378, 34.7864282, 'drinking_water', false),
  ('node/6873369872', 32.0718133, 34.7875917, 'drinking_water', false),
  ('node/6873385936', 32.07226, 34.7872, 'drinking_water', false),
  ('node/6875640396', 32.1010683, 34.774795, 'drinking_water', false),
  ('node/6875650905', 32.09932, 34.7747433, 'drinking_water', false),
  ('node/6898405031', 32.1001592, 34.7749103, 'drinking_water', false),
  ('node/6931102385', 32.1908584, 34.810579, 'drinking_water', false),
  ('node/6956745302', 31.9877113, 34.7772804, 'drinking_water', false),
  ('node/6990417541', 31.9521402, 34.8119481, 'drinking_water', false),
  ('node/6990417551', 31.9528463, 34.8124324, 'drinking_water', false),
  ('node/6990417560', 31.9527237, 34.8123346, 'drinking_water', false),
  ('node/7176888400', 31.9331817, 34.7869672, 'drinking_water', false),
  ('node/7176888403', 31.9327263, 34.7877047, 'drinking_water', false),
  ('node/7179380498', 31.9505535, 34.8045005, 'drinking_water', false),
  ('node/7179380532', 31.9511287, 34.8042621, 'drinking_water', false),
  ('node/7210980624', 31.9890881, 34.7858376, 'drinking_water', false),
  ('node/7248297341', 32.0715885, 34.7909189, 'drinking_water', false),
  ('node/7250920225', 32.0004817, 34.7330983, 'drinking_water', false),
  ('node/7251252228', 32.0023833, 34.7335883, 'drinking_water', false),
  ('node/7257985595', 32.1381251, 34.8461039, 'drinking_water', false),
  ('node/7273997736', 32.03185, 34.8209099, 'drinking_water', false),
  ('node/7273997737', 32.0291546, 34.8219069, 'drinking_water', false),
  ('node/7501610514', 32.1539473, 34.8371934, 'drinking_water', false),
  ('node/7501627292', 32.1534746, 34.8386304, 'drinking_water', false),
  ('node/7501627298', 32.1533193, 34.8417709, 'drinking_water', false),
  ('node/7519186856', 31.9692049, 34.7776709, 'drinking_water', false),
  ('node/7557297383', 32.1494992, 34.8349468, 'drinking_water', false),
  ('node/7606776242', 32.1572242, 34.8366125, 'drinking_water', false),
  ('node/7738089860', 32.1705486, 34.8554917, 'drinking_water', false),
  ('node/7739938549', 32.1690276, 34.8549801, 'drinking_water', false),
  ('node/7741600989', 32.1683831, 34.8513734, 'drinking_water', false),
  ('node/7823247685', 32.1714837, 34.8490456, 'drinking_water', false),
  ('node/7835235697', 32.1750253, 34.8509643, 'drinking_water', false),
  ('node/7866526911', 32.0697456, 34.8296683, 'drinking_water', false),
  ('node/7946040635', 32.1405108, 34.8468184, 'drinking_water', false),
  ('node/7946040639', 32.1409979, 34.8468846, 'drinking_water', false),
  ('node/7946040640', 32.1406472, 34.8467433, 'drinking_water', false),
  ('node/7978622411', 32.1387713, 34.8454377, 'drinking_water', false),
  ('node/7978622412', 32.1391772, 34.845863, 'drinking_water', false),
  ('node/7978622439', 32.1398936, 34.8468049, 'drinking_water', false),
  ('node/7993402778', 31.9723628, 34.7599264, 'drinking_water', false),
  ('node/7993402779', 31.9667387, 34.7630424, 'drinking_water', false),
  ('node/7993402780', 31.9706627, 34.7593094, 'drinking_water', false),
  ('node/8000669846', 32.1680447, 34.8548105, 'drinking_water', false),
  ('node/8010685780', 32.1666848, 34.8586193, 'drinking_water', false),
  ('node/8013980640', 31.9736933, 34.7608888, 'drinking_water', false),
  ('node/8013980641', 31.963861, 34.768339, 'drinking_water', false),
  ('node/8043803651', 31.9652536, 34.7657765, 'drinking_water', false),
  ('node/8051262090', 32.1992645, 34.8498296, 'drinking_water', false),
  ('node/8071504318', 31.9787049, 34.7591239, 'drinking_water', false),
  ('node/8077333071', 31.9648098, 34.7668176, 'drinking_water', false),
  ('node/8081925349', 32.189408, 34.8273153, 'drinking_water', false),
  ('node/8090566026', 31.9599566, 34.7779126, 'drinking_water', false),
  ('node/8090746836', 31.9596986, 34.7755942, 'drinking_water', false),
  ('node/8090746838', 31.9599737, 34.7764873, 'drinking_water', false),
  ('node/8094491417', 32.1595639, 34.8213445, 'drinking_water', false),
  ('node/8099784763', 31.9723677, 34.8104525, 'drinking_water', false),
  ('node/8128542989', 31.9474261, 34.8314641, 'drinking_water', false),
  ('node/8128543014', 31.9466071, 34.8307072, 'drinking_water', false),
  ('node/8128567029', 31.9472096, 34.8307188, 'drinking_water', false),
  ('node/8128567037', 31.9471032, 34.8314778, 'drinking_water', false),
  ('node/8128567039', 31.9466667, 34.8312618, 'drinking_water', false),
  ('node/8166912163', 31.9676699, 34.7640625, 'drinking_water', false),
  ('node/8183084721', 31.9985073, 34.7594838, 'drinking_water', false),
  ('node/8189956942', 31.976816, 34.7771739, 'drinking_water', false),
  ('node/8297971778', 32.0470024, 34.8216185, 'drinking_water', false),
  ('node/8442862819', 31.962947, 34.8034868, 'drinking_water', false),
  ('node/8568999304', 32.1637797, 34.7954668, 'drinking_water', false),
  ('node/8569000636', 32.0384712, 34.7612316, 'drinking_water', false),
  ('node/8569818813', 32.057838, 34.7742967, 'drinking_water', false),
  ('node/8569835925', 32.0467179, 34.7749991, 'drinking_water', false),
  ('node/8571135109', 32.0880171, 34.81185, 'drinking_water', false),
  ('node/8592228818', 32.1036107, 34.7918024, 'drinking_water', false),
  ('node/8653068604', 32.1489628, 34.8304424, 'drinking_water', false),
  ('node/8764418823', 31.977009, 34.8077453, 'drinking_water', false),
  ('node/8771363712', 31.9759661, 34.8051942, 'drinking_water', false),
  ('node/8778731365', 31.9796175, 34.8007995, 'drinking_water', false),
  ('node/8778731370', 31.9831778, 34.8097375, 'drinking_water', false),
  ('node/8780504125', 32.1304003, 34.8379007, 'drinking_water', false),
  ('node/8780504126', 32.1307367, 34.8391581, 'drinking_water', false),
  ('node/8829855886', 31.9691322, 34.76617, 'drinking_water', false),
  ('node/8844838464', 31.9599256, 34.8171069, 'drinking_water', false),
  ('node/8849838768', 31.9746324, 34.8069229, 'drinking_water', false),
  ('node/8850792966', 31.9676352, 34.7697957, 'drinking_water', false),
  ('node/8869448476', 31.9853323, 34.7680386, 'drinking_water', false),
  ('node/8869448477', 31.9854849, 34.7677489, 'drinking_water', false),
  ('node/8870242138', 32.055557, 34.8451212, 'drinking_water', false),
  ('node/8872084064', 32.0417631, 34.7937465, 'drinking_water', false),
  ('node/8894794324', 32.0563188, 34.8450051, 'drinking_water', false),
  ('node/8901748020', 32.0722827, 34.8442519, 'drinking_water', false),
  ('node/8901748022', 32.0671825, 34.8476119, 'drinking_water', false),
  ('node/8901748026', 32.0681713, 34.8451137, 'drinking_water', false),
  ('node/8901748029', 32.0738239, 34.8483945, 'drinking_water', false),
  ('node/8916975541', 32.0672713, 34.8417405, 'drinking_water', false),
  ('node/8916975542', 32.067708, 34.841766, 'drinking_water', false),
  ('node/8920256490', 32.0660583, 34.8454285, 'drinking_water', false),
  ('node/8935040248', 32.0475136, 34.8354915, 'drinking_water', false),
  ('node/8935505130', 32.0318464, 34.7833164, 'drinking_water', false),
  ('node/8951670383', 32.0203806, 34.7725364, 'drinking_water', false),
  ('node/8951670385', 32.02216, 34.774875, 'drinking_water', false),
  ('node/8954096002', 32.0640287, 34.8537975, 'drinking_water', false),
  ('node/8956456461', 32.0553073, 34.8445328, 'drinking_water', false),
  ('node/8977697133', 31.940085, 34.7935268, 'drinking_water', false),
  ('node/8992570098', 32.0664791, 34.8451928, 'drinking_water', false),
  ('node/8992570099', 32.0543096, 34.8440494, 'drinking_water', false),
  ('node/9010560723', 32.0240604, 34.7718161, 'drinking_water', false),
  ('node/9015379859', 32.065756, 34.8578628, 'drinking_water', false),
  ('node/9015909009', 31.9695457, 34.7985198, 'drinking_water', false),
  ('node/9045455618', 32.0996805, 34.8090509, 'drinking_water', false),
  ('node/9083640735', 31.9805291, 34.7444934, 'drinking_water', false),
  ('node/9083640750', 31.9770742, 34.7435117, 'drinking_water', false),
  ('node/9122472327', 32.0608169, 34.7621547, 'drinking_water', false),
  ('node/9135716482', 31.977152, 34.765545, 'drinking_water', false),
  ('node/9139946984', 31.9635352, 34.8041208, 'drinking_water', false),
  ('node/9150021016', 31.9799567, 34.8034802, 'drinking_water', false),
  ('node/9209183452', 31.9823633, 34.7798523, 'drinking_water', false),
  ('node/9280786506', 31.949576, 34.8074626, 'drinking_water', false),
  ('node/9280787886', 31.9501358, 34.804493, 'drinking_water', false),
  ('node/9285366550', 31.9697675, 34.794342, 'drinking_water', false),
  ('node/9285366602', 31.9679254, 34.7907954, 'drinking_water', false),
  ('node/9285366625', 31.9687295, 34.7907665, 'drinking_water', false),
  ('node/9285366666', 31.9684913, 34.7916549, 'drinking_water', false),
  ('node/9287935446', 31.9652501, 34.7889267, 'drinking_water', false),
  ('node/9300506394', 31.9625897, 34.8034423, 'drinking_water', false),
  ('node/9310422787', 32.1734643, 34.8276856, 'drinking_water', false),
  ('node/9310422800', 32.1741456, 34.8263487, 'drinking_water', false),
  ('node/9510668594', 31.9541859, 34.8085749, 'drinking_water', false),
  ('node/9515727972', 31.9695893, 34.7899402, 'drinking_water', false),
  ('node/9515727989', 31.9692862, 34.7899342, 'drinking_water', false),
  ('node/9515727999', 31.9701749, 34.7902584, 'drinking_water', false),
  ('node/9556596564', 32.0691841, 34.7631378, 'drinking_water', false),
  ('node/9565580139', 31.98588, 34.8052721, 'drinking_water', false),
  ('node/9585096146', 31.9716835, 34.7909495, 'drinking_water', false),
  ('node/9585096148', 31.9697859, 34.7901175, 'drinking_water', false),
  ('node/9585096153', 31.9693653, 34.7899912, 'drinking_water', false),
  ('node/9585096160', 31.9714738, 34.7936398, 'drinking_water', false),
  ('node/9585096161', 31.9684555, 34.7896338, 'drinking_water', false),
  ('node/9609481203', 31.9643243, 34.823153, 'drinking_water', false),
  ('node/9628426683', 31.9849645, 34.7581875, 'drinking_water', false),
  ('node/9676464590', 32.1797376, 34.8028013, 'drinking_water', false),
  ('node/9676480652', 32.1579571, 34.7956225, 'drinking_water', false),
  ('node/9689337287', 32.052506, 34.8228524, 'drinking_water', false),
  ('node/9721096581', 32.0749453, 34.7654851, 'drinking_water', false),
  ('node/9722355544', 32.1950601, 34.8476652, 'drinking_water', false),
  ('node/9727215659', 31.9590544, 34.8187771, 'drinking_water', false),
  ('node/9734465211', 32.1874679, 34.8204242, 'drinking_water', false),
  ('node/9749378722', 31.9478634, 34.8111854, 'drinking_water', false),
  ('node/9758642394', 32.011105, 34.794946, 'drinking_water', false),
  ('node/9758736295', 32.0329332, 34.7755438, 'drinking_water', false),
  ('node/9770451529', 32.0855056, 34.7975651, 'drinking_water', false),
  ('node/9811236418', 32.0412153, 34.7476899, 'drinking_water', false),
  ('node/9831103214', 32.0031275, 34.7989641, 'drinking_water', false),
  ('node/9831353921', 32.0725288, 34.764323, 'drinking_water', false),
  ('node/9836061812', 32.009716, 34.7705897, 'drinking_water', false),
  ('node/9836195841', 32.1156598, 34.7971722, 'drinking_water', false),
  ('node/9836207300', 32.1143727, 34.7944969, 'drinking_water', false),
  ('node/9837945922', 32.1149012, 34.7968266, 'drinking_water', false),
  ('node/9890661371', 32.1703791, 34.8273797, 'drinking_water', false),
  ('node/9905417699', 32.1220378, 34.7972411, 'drinking_water', false),
  ('node/9910324536', 32.122986, 34.7912349, 'drinking_water', false),
  ('node/9976757562', 31.9774334, 34.8040835, 'drinking_water', false),
  ('node/10008292933', 32.012529, 34.7776664, 'drinking_water', false),
  ('node/10011088231', 31.973737, 34.7829161, 'drinking_water', false),
  ('node/10011088238', 31.9732255, 34.7825852, 'drinking_water', false),
  ('node/10087468255', 32.0140888, 34.7375792, 'drinking_water', false),
  ('node/10087468256', 32.0142537, 34.7376209, 'drinking_water', false),
  ('node/10092219774', 32.187027, 34.8492875, 'drinking_water', false),
  ('node/10092219775', 32.1866282, 34.8488379, 'drinking_water', false),
  ('node/10118138740', 31.9704499, 34.7619502, 'drinking_water', false),
  ('node/10147124412', 32.1275066, 34.8264829, 'drinking_water', false),
  ('node/10199252385', 31.9699138, 34.7675968, 'drinking_water', false),
  ('node/10199269117', 31.9696402, 34.7672112, 'drinking_water', false),
  ('node/10199269120', 31.9670342, 34.7680832, 'drinking_water', false),
  ('node/10204233978', 32.0431735, 34.8060136, 'drinking_water', false),
  ('node/10557303207', 31.9974878, 34.7320094, 'drinking_water', false),
  ('node/10559732410', 32.040414, 34.8592957, 'drinking_water', false),
  ('node/10574650041', 32.0736471, 34.7734232, 'drinking_water', false),
  ('node/10583688605', 32.1468627, 34.83567, 'drinking_water', false),
  ('node/10601233039', 31.9766239, 34.7724199, 'drinking_water', false),
  ('node/10690134424', 31.9690761, 34.7611362, 'drinking_water', false),
  ('node/10690632103', 32.01873, 34.7640494, 'drinking_water', false),
  ('node/10692756566', 32.0340912, 34.7677472, 'drinking_water', false),
  ('node/10692756574', 32.0332561, 34.7637426, 'drinking_water', false),
  ('node/10692756575', 32.0339216, 34.7632573, 'drinking_water', false),
  ('node/10692756576', 32.0341544, 34.7685795, 'drinking_water', false),
  ('node/10693769354', 32.0237199, 34.7756824, 'drinking_water', false),
  ('node/10694627197', 32.0113016, 34.7641495, 'drinking_water', false),
  ('node/10694627202', 32.0190295, 34.7954375, 'drinking_water', false),
  ('node/10694627203', 31.9991015, 34.7740739, 'drinking_water', false),
  ('node/10694627204', 32.0069364, 34.763667, 'drinking_water', false),
  ('node/10694642609', 32.0022828, 34.7667416, 'drinking_water', false),
  ('node/10694642611', 32.0002212, 34.7648255, 'drinking_water', false),
  ('node/10694642615', 32.0099832, 34.7640933, 'drinking_water', false),
  ('node/10699401241', 32.1155103, 34.7854936, 'drinking_water', false),
  ('node/10709226926', 32.022526, 34.7436811, 'drinking_water', false),
  ('node/10709226927', 32.0270459, 34.7483478, 'drinking_water', false),
  ('node/10709226928', 32.023906, 34.7473376, 'drinking_water', false),
  ('node/10719124389', 32.1234785, 34.8016843, 'drinking_water', false),
  ('node/10719124404', 32.1227393, 34.8033981, 'drinking_water', false),
  ('node/10719151012', 32.1234105, 34.8017998, 'drinking_water', false),
  ('node/10727973205', 32.0728346, 34.7873993, 'drinking_water', false),
  ('node/10741199506', 31.966019, 34.7668987, 'drinking_water', false),
  ('node/10741199526', 31.9642261, 34.7683088, 'drinking_water', false),
  ('node/10759905760', 32.1009284, 34.8573809, 'drinking_water', false),
  ('node/10759933507', 32.0779013, 34.7925077, 'drinking_water', false),
  ('node/10759934441', 32.0745971, 34.7902755, 'drinking_water', false),
  ('node/10759935366', 32.0728819, 34.7857178, 'drinking_water', false),
  ('node/10759939193', 32.0681544, 34.7818722, 'drinking_water', false),
  ('node/10759944938', 32.0650076, 34.7823035, 'drinking_water', false),
  ('node/10759945202', 32.0703903, 34.7888346, 'drinking_water', false),
  ('node/10759946396', 32.0900194, 34.7996245, 'drinking_water', false),
  ('node/10759947254', 32.0798441, 34.7995882, 'drinking_water', false),
  ('node/10760973668', 32.0781467, 34.7740245, 'drinking_water', false),
  ('node/10761012263', 32.0732143, 34.7728282, 'drinking_water', false),
  ('node/10778621120', 32.041906, 34.7631439, 'drinking_water', false),
  ('node/10798856805', 32.0541407, 34.7846221, 'drinking_water', false),
  ('node/10807325496', 32.1298254, 34.8202905, 'drinking_water', false),
  ('node/10830908586', 32.0802389, 34.7671589, 'drinking_water', false),
  ('node/10831171037', 32.058911, 34.7640331, 'drinking_water', false),
  ('node/10836348158', 31.9519298, 34.8039695, 'drinking_water', false),
  ('node/10870009435', 31.9666835, 34.7904428, 'drinking_water', false),
  ('node/10874270420', 32.0795688, 34.8280797, 'drinking_water', false),
  ('node/10878541573', 32.061011, 34.7688613, 'drinking_water', false),
  ('node/10911862505', 32.1201462, 34.7989376, 'drinking_water', false),
  ('node/10978480937', 32.1995127, 34.8505338, 'drinking_water', false),
  ('node/11007239096', 32.05665, 34.76434, 'drinking_water', false),
  ('node/11007264121', 32.05216, 34.76055, 'drinking_water', false),
  ('node/11007774596', 32.187645, 34.8045353, 'drinking_water', false),
  ('node/11010582087', 32.0691032, 34.7967291, 'drinking_water', false),
  ('node/11010594010', 32.0709525, 34.7973627, 'drinking_water', false),
  ('node/11021254291', 32.0548357, 34.7557289, 'drinking_water', false),
  ('node/11034766505', 32.1350941, 34.8393173, 'drinking_water', false),
  ('node/11063068506', 32.1144343, 34.8173331, 'drinking_water', false),
  ('node/11123697211', 32.1368425, 34.845006, 'drinking_water', false),
  ('node/11151682905', 32.1391722, 34.8365194, 'drinking_water', false),
  ('node/11160427602', 32.1054537, 34.8355595, 'drinking_water', false),
  ('node/11176810943', 32.0833979, 34.7896621, 'drinking_water', false),
  ('node/11187731982', 31.9766338, 34.7627214, 'drinking_water', false),
  ('node/11187731983', 31.972747, 34.7691543, 'drinking_water', false),
  ('node/11207467700', 32.1014861, 34.8596936, 'drinking_water', false),
  ('node/11217619297', 32.0784943, 34.787639, 'drinking_water', false),
  ('node/11222150525', 32.0641215, 34.7749382, 'drinking_water', false),
  ('node/11243099662', 31.9625092, 34.8263613, 'drinking_water', false),
  ('node/11262011633', 32.1338389, 34.7884895, 'drinking_water', false),
  ('node/11262060342', 32.1393164, 34.7897234, 'drinking_water', false),
  ('node/11266811676', 31.9818383, 34.7718952, 'drinking_water', false),
  ('node/11269407059', 32.1276307, 34.7869045, 'drinking_water', false),
  ('node/11269426983', 32.1313567, 34.7880375, 'drinking_water', false),
  ('node/11269452279', 32.1249094, 34.7854636, 'drinking_water', false),
  ('node/11269471107', 32.1362581, 34.788944, 'drinking_water', false),
  ('node/11269491522', 32.1401585, 34.790489, 'drinking_water', false),
  ('node/11299964971', 31.9884863, 34.7758654, 'drinking_water', false),
  ('node/11309815967', 31.9999795, 34.7892397, 'drinking_water', false),
  ('node/11309895062', 32.0049893, 34.7836984, 'drinking_water', false),
  ('node/11357922800', 31.9702274, 34.7671695, 'drinking_water', false),
  ('node/11375013359', 32.1260989, 34.7854111, 'drinking_water', false),
  ('node/11375016986', 32.1306108, 34.7870748, 'drinking_water', false),
  ('node/11389763486', 31.962492, 34.7989717, 'drinking_water', false),
  ('node/11397504656', 31.9710117, 34.7834374, 'drinking_water', false),
  ('node/11398903736', 32.0795812, 34.792493, 'drinking_water', false),
  ('node/11407794661', 31.9802304, 34.7580029, 'drinking_water', false),
  ('node/11428439417', 32.0155092, 34.738201, 'drinking_water', false),
  ('node/11428443121', 31.9978399, 34.7323955, 'drinking_water', false),
  ('node/11434636104', 32.099795, 34.822769, 'drinking_water', false),
  ('node/11487024474', 31.9714317, 34.8027616, 'drinking_water', false),
  ('node/11494460104', 31.9580828, 34.830232, 'drinking_water', false),
  ('node/11533671362', 31.9776669, 34.7846799, 'drinking_water', false),
  ('node/11745398043', 31.9674736, 34.8216872, 'drinking_water', false),
  ('node/11745398057', 31.9673039, 34.8216981, 'drinking_water', false),
  ('node/11769564585', 31.9748165, 34.7896394, 'drinking_water', false),
  ('node/11919389269', 32.0834562, 34.7980959, 'drinking_water', false),
  ('node/11951932169', 31.9792636, 34.8084722, 'drinking_water', false),
  ('node/11952017967', 31.9458631, 34.8288368, 'drinking_water', false),
  ('node/11966392369', 32.0077309, 34.7783271, 'drinking_water', false),
  ('node/11983504064', 31.9358307, 34.8272075, 'drinking_water', false),
  ('node/11983517927', 31.9353449, 34.8272164, 'drinking_water', false),
  ('node/11983517928', 31.9374647, 34.8270294, 'drinking_water', false),
  ('node/11983575985', 31.9407016, 34.8270007, 'drinking_water', false),
  ('node/11983575986', 31.9412959, 34.8269787, 'drinking_water', false),
  ('node/12027201329', 32.0746872, 34.7795879, 'drinking_water', false),
  ('node/12031435669', 32.0067108, 34.7796679, 'drinking_water', false),
  ('node/12050978799', 32.0396631, 34.7784531, 'drinking_water', false),
  ('node/12050978800', 32.0397167, 34.7786094, 'drinking_water', false),
  ('node/12050994080', 32.0392599, 34.7781411, 'drinking_water', false),
  ('node/12051065517', 32.0441349, 34.7750508, 'drinking_water', false),
  ('node/12052456769', 32.1028553, 34.830241, 'drinking_water', false),
  ('node/12061468241', 31.9593531, 34.8118706, 'drinking_water', false),
  ('node/12070526956', 32.0522846, 34.7496698, 'drinking_water', false),
  ('node/12070569742', 31.9570067, 34.8237611, 'drinking_water', false),
  ('node/12075053154', 32.0732676, 34.7768355, 'drinking_water', false),
  ('node/12075073327', 32.0706822, 34.7736845, 'drinking_water', false),
  ('node/12090665921', 31.963323, 34.8175288, 'drinking_water', false),
  ('node/12090665922', 31.9634343, 34.817688, 'drinking_water', false),
  ('node/12090665923', 31.968003, 34.819907, 'drinking_water', false),
  ('node/12090668598', 31.9689626, 34.8204372, 'drinking_water', false),
  ('node/12100508552', 32.0852703, 34.7835513, 'drinking_water', false),
  ('node/12100586911', 32.0819037, 34.7789735, 'drinking_water', false),
  ('node/12100738365', 31.940697, 34.7936461, 'drinking_water', false),
  ('node/12111436699', 32.1738707, 34.829835, 'drinking_water', false),
  ('node/12111436700', 32.1735375, 34.8300469, 'drinking_water', false),
  ('node/12131144652', 32.083578, 34.7957523, 'drinking_water', false),
  ('node/12133726630', 32.0586044, 34.7710174, 'drinking_water', false),
  ('node/12134456396', 31.9606545, 34.7888332, 'drinking_water', false),
  ('node/12165715561', 32.0956655, 34.8072513, 'drinking_water', false),
  ('node/12196629805', 32.0782802, 34.7835461, 'drinking_water', false),
  ('node/12196629806', 32.0779223, 34.7835724, 'drinking_water', false),
  ('node/12246719905', 31.9673258, 34.774883, 'drinking_water', false),
  ('node/12269378369', 32.0481844, 34.8255151, 'drinking_water', false),
  ('node/12269378370', 32.0479231, 34.8226934, 'drinking_water', false),
  ('node/12269378371', 32.0494228, 34.8234131, 'drinking_water', false),
  ('node/12290037591', 32.0988221, 34.8132829, 'drinking_water', false),
  ('node/12290037594', 32.1000863, 34.8130409, 'drinking_water', false),
  ('node/12290189830', 32.1011727, 34.8106192, 'drinking_water', false),
  ('node/12290189858', 32.1012642, 34.8117957, 'drinking_water', false),
  ('node/12290319723', 32.1017559, 34.8096544, 'drinking_water', false),
  ('node/12290319725', 32.1014748, 34.8090482, 'drinking_water', false),
  ('node/12305071801', 32.1535415, 34.8514718, 'drinking_water', false),
  ('node/12505205420', 31.9688759, 34.8167548, 'drinking_water', false),
  ('node/12515220623', 31.9703072, 34.8095094, 'drinking_water', false),
  ('node/12559083939', 31.9685455, 34.8153124, 'drinking_water', false),
  ('node/12571107095', 31.9611645, 34.7977091, 'drinking_water', false),
  ('node/12571121711', 31.9609265, 34.7976935, 'drinking_water', false),
  ('node/12630157232', 32.0603981, 34.8165728, 'drinking_water', false),
  ('node/12636773002', 31.9714286, 34.8103867, 'drinking_water', false),
  ('node/12684508711', 32.0511322, 34.7625911, 'drinking_water', false),
  ('node/12710140358', 31.9777614, 34.7791505, 'drinking_water', false),
  ('node/12710140374', 31.978586, 34.779424, 'drinking_water', false),
  ('node/12731253738', 32.0338833, 34.7706843, 'drinking_water', false),
  ('node/12731253739', 32.0328038, 34.7706241, 'drinking_water', false),
  ('node/12741189160', 32.0515308, 34.8541267, 'drinking_water', false),
  ('node/12751997344', 31.9854844, 34.774898, 'drinking_water', false),
  ('node/12751997369', 31.9859688, 34.7752605, 'drinking_water', false),
  ('node/12777060701', 32.1078652, 34.8166438, 'drinking_water', false),
  ('node/12778791572', 31.9581596, 34.7969708, 'drinking_water', false),
  ('node/12778791574', 31.9577008, 34.7970108, 'drinking_water', false),
  ('node/12778791579', 31.9567315, 34.7979309, 'drinking_water', false),
  ('node/12778985663', 31.9583333, 34.8019122, 'drinking_water', false),
  ('node/12781991049', 32.0562634, 34.7643398, 'drinking_water', false),
  ('node/12791040810', 32.0507897, 34.7636896, 'drinking_water', false),
  ('node/12791040815', 32.0512486, 34.7637771, 'drinking_water', false),
  ('node/12791788473', 32.064723, 34.7849397, 'drinking_water', false),
  ('node/12802065901', 32.109456, 34.8184511, 'drinking_water', false),
  ('node/12871241693', 32.1759145, 34.8511681, 'drinking_water', false),
  ('node/12871296030', 32.1763759, 34.851595, 'drinking_water', false),
  ('node/12871325242', 32.18492, 34.8541145, 'drinking_water', false),
  ('node/12906345738', 32.0713858, 34.7789753, 'drinking_water', false),
  ('node/12914207542', 32.1805949, 34.8510721, 'drinking_water', false),
  ('node/12942054801', 32.0078092, 34.7809749, 'drinking_water', false),
  ('node/12945859069', 32.0946741, 34.8062207, 'drinking_water', false),
  ('node/12949823020', 32.0705324, 34.7788166, 'drinking_water', false),
  ('node/12987936701', 32.1065144, 34.8385099, 'drinking_water', false),
  ('node/12990551864', 32.1356957, 34.8477276, 'drinking_water', false),
  ('node/13011829775', 32.165865, 34.822427, 'drinking_water', false),
  ('node/13011851687', 32.1669547, 34.8235131, 'drinking_water', false),
  ('node/13011894207', 32.171498, 34.8236387, 'drinking_water', false),
  ('node/13015833737', 32.1748672, 34.8348987, 'drinking_water', false),
  ('node/13111799269', 32.1600367, 34.8102798, 'drinking_water', false),
  ('node/13122967701', 32.0075707, 34.7822025, 'drinking_water', false),
  ('node/13128274201', 32.0145435, 34.776863, 'drinking_water', false),
  ('node/13128286503', 32.014963, 34.7768672, 'drinking_water', false),
  ('node/13160591517', 32.0380531, 34.8582903, 'drinking_water', false),
  ('node/13160618248', 32.0384338, 34.8563712, 'drinking_water', false),
  ('node/13173814534', 32.0607353, 34.7673818, 'drinking_water', false),
  ('node/13193516063', 31.9680395, 34.7612549, 'drinking_water', false),
  ('node/13200379919', 31.9845463, 34.7507281, 'drinking_water', false),
  ('node/13200379927', 31.9853847, 34.7488228, 'drinking_water', false),
  ('node/13200379947', 31.9857801, 34.7479975, 'drinking_water', false),
  ('node/13200379953', 31.983798, 34.749904, 'drinking_water', false),
  ('node/13200379968', 31.9848685, 34.7493997, 'drinking_water', false),
  ('node/13248109947', 32.0528847, 34.7552903, 'drinking_water', false),
  ('node/13253044306', 32.0614273, 34.7752505, 'drinking_water', false),
  ('node/13253044308', 32.0890526, 34.779698, 'drinking_water', false),
  ('node/13275234244', 32.1990846, 34.8467996, 'drinking_water', false),
  ('node/13281213019', 31.9746762, 34.7953075, 'drinking_water', false),
  ('node/13316852126', 31.9687703, 34.8225986, 'drinking_water', false),
  ('node/13316852129', 31.9688919, 34.8238878, 'drinking_water', false),
  ('node/13316852143', 31.9708632, 34.8234445, 'drinking_water', false),
  ('node/13316852146', 31.9688422, 34.8216049, 'drinking_water', false),
  ('node/13316885384', 31.9674517, 34.8226722, 'drinking_water', false),
  ('node/13325822001', 31.9713591, 34.7799522, 'drinking_water', false),
  ('node/13338643653', 32.0475201, 34.7527924, 'drinking_water', false),
  ('node/13361294284', 32.0050515, 34.7358067, 'drinking_water', false),
  ('node/13361294287', 32.0055154, 34.7359533, 'drinking_water', false),
  ('node/13361294290', 32.0068551, 34.7348886, 'drinking_water', false),
  ('node/13361294291', 31.9984157, 34.7323361, 'drinking_water', false),
  ('node/13424384604', 32.0927092, 34.8028789, 'drinking_water', false),
  ('node/13449949688', 32.0572365, 34.8507147, 'drinking_water', false),
  ('node/13455457068', 32.0402701, 34.8583962, 'drinking_water', false),
  ('node/13504120263', 32.1038478, 34.8048594, 'drinking_water', false),
  ('node/13511609031', 32.035777, 34.8563316, 'drinking_water', false),
  ('node/13516584172', 32.0702454, 34.8438596, 'drinking_water', false),
  ('node/13522986206', 32.1708283, 34.8287203, 'drinking_water', false),
  ('node/13527240089', 32.1134651, 34.8058879, 'drinking_water', false),
  ('node/13542640083', 32.0719564, 34.7798609, 'drinking_water', false),
  ('node/13579890601', 32.0547781, 34.7604138, 'drinking_water', false),
  ('node/13607129495', 32.008898, 34.7803527, 'drinking_water', false),
  ('node/13648539605', 32.0808702, 34.803158, 'drinking_water', false),
  ('node/13648539768', 32.0809248, 34.8035109, 'drinking_water', false),
  ('node/13648539769', 32.0809287, 34.8035087, 'drinking_water', false),
  ('node/13673593104', 32.0610051, 34.7738596, 'drinking_water', false),
  ('node/13732527948', 31.9746613, 34.8143567, 'drinking_water', false),
  ('node/13806640882', 31.963815, 34.8080217, 'drinking_water', false),
  ('node/13806640883', 31.963695, 34.8088137, 'drinking_water', false),
  ('node/13806646984', 32.0059767, 34.7361504, 'drinking_water', false),
  ('node/13831381407', 32.023236, 34.7571303, 'drinking_water', false),
  ('node/13840512016', 32.0094813, 34.7813526, 'drinking_water', false),
  ('node/13840512024', 32.0095935, 34.7812169, 'drinking_water', false),
  ('node/13840512025', 32.0093562, 34.7816457, 'drinking_water', false),
  ('node/13840512038', 32.009198, 34.7816277, 'drinking_water', false),
  ('node/13876216986', 32.0967596, 34.7838726, 'drinking_water', false),
  ('node/13964187610', 31.9453562, 34.8322928, 'drinking_water', false),
  ('node/14039904222', 32.1033157, 34.7773797, 'drinking_water', false),
  ('node/14074580546', 32.0632132, 34.8023234, 'drinking_water', false),
  ('node/14074584689', 32.0639283, 34.7999818, 'drinking_water', false),
  ('node/14080612236', 31.9806828, 34.8016075, 'drinking_water', false),
  ('node/14080660449', 31.9858359, 34.8050338, 'drinking_water', false),
  ('node/14080660450', 31.9863442, 34.8071233, 'drinking_water', false),
  ('node/14096574787', 32.0048406, 34.7372927, 'drinking_water', false),
  ('node/14135567127', 32.081773, 34.7965108, 'drinking_water', false),
  ('node/14155463374', 31.9746581, 34.7959989, 'drinking_water', false),
  ('way/659598297', 32.0550461, 34.7549909, 'drinking_water', false)
ON CONFLICT (osm_id) DO NOTHING;

-- markers type='park' (556 новых после дедупа <50м)
INSERT INTO public.markers (user_id, type, lat, lng, description, expires_at, confirmations, denials)
SELECT v.user_id, v.type, v.lat, v.lng, v.description, v.expires_at, v.confirmations, v.denials
FROM (VALUES
  -- way/24893732
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0784496::double precision, 34.778498::double precision, 'ככר מסריק'::text, NULL::timestamptz, 0, 0),
  -- way/26301651
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0809214::double precision, 34.7875321::double precision, 'גן אריסון'::text, NULL::timestamptz, 0, 0),
  -- way/26301668
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0824124::double precision, 34.7861598::double precision, 'גן סוטין'::text, NULL::timestamptz, 0, 0),
  -- way/26515474
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.179272::double precision, 34.8096329::double precision, 'גינת וריזלנד'::text, NULL::timestamptz, 0, 0),
  -- way/28214452
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1844421::double precision, 34.8077847::double precision, 'גן שמואל תמיר'::text, NULL::timestamptz, 0, 0),
  -- way/28446240
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9576001::double precision, 34.7968849::double precision, 'זמסקי'::text, NULL::timestamptz, 0, 0),
  -- way/28446241
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9582289::double precision, 34.7969706::double precision, 'גן כהן אהרון'::text, NULL::timestamptz, 0, 0),
  -- way/28658262
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9600358::double precision, 34.7894774::double precision, 'גן הר ציון'::text, NULL::timestamptz, 0, 0),
  -- way/28988613
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0511841::double precision, 34.763458::double precision, 'גן כרונינגן'::text, NULL::timestamptz, 0, 0),
  -- way/29127741
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1920396::double precision, 34.8616757::double precision, 'הספורטק הישן'::text, NULL::timestamptz, 0, 0),
  -- way/30127380
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0944626::double precision, 34.7819583::double precision, 'כיכר היל'::text, NULL::timestamptz, 0, 0),
  -- way/30127397
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.09373::double precision, 34.7818582::double precision, 'גן ברנדר'::text, NULL::timestamptz, 0, 0),
  -- way/30146258
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0777653::double precision, 34.7844353::double precision, 'גינת דובנוב'::text, NULL::timestamptz, 0, 0),
  -- way/30742281
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0819656::double precision, 34.7751769::double precision, 'גן פורסט היל'::text, NULL::timestamptz, 0, 0),
  -- way/30773602
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.093496::double precision, 34.777344::double precision, 'גן גימפל'::text, NULL::timestamptz, 0, 0),
  -- way/30781000
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.087319::double precision, 34.778621::double precision, 'גן מלץ'::text, NULL::timestamptz, 0, 0),
  -- way/30826885
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0943397::double precision, 34.796569::double precision, 'גן אברמוביץ'''::text, NULL::timestamptz, 0, 0),
  -- way/30828437
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0911406::double precision, 34.7868119::double precision, 'גן נורי'::text, NULL::timestamptz, 0, 0),
  -- way/30879066
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.084789::double precision, 34.791569::double precision, 'גן הגת'::text, NULL::timestamptz, 0, 0),
  -- way/30879232
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.089197::double precision, 34.7897537::double precision, 'גן פולק'::text, NULL::timestamptz, 0, 0),
  -- way/31066186
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0589514::double precision, 34.8061941::double precision, 'פארק אדית וולפסון'::text, NULL::timestamptz, 0, 0),
  -- way/31536342
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0884412::double precision, 34.7709225::double precision, 'גן שפיגל'::text, NULL::timestamptz, 0, 0),
  -- way/31539397
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0737781::double precision, 34.7775402::double precision, 'גינת צמח'::text, NULL::timestamptz, 0, 0),
  -- way/31539405
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0752827::double precision, 34.7774963::double precision, 'גן קרוון'::text, NULL::timestamptz, 0, 0),
  -- way/31539863
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0892298::double precision, 34.7907904::double precision, 'גן משה כהן'::text, NULL::timestamptz, 0, 0),
  -- way/33493227
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1158583::double precision, 34.8361297::double precision, 'גן סעדיה שושני'::text, NULL::timestamptz, 0, 0),
  -- way/33631428
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0730576::double precision, 34.7731001::double precision, 'גן מאיר'::text, NULL::timestamptz, 0, 0),
  -- way/33910221
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0192829::double precision, 34.7488792::double precision, 'גן רוטרי'::text, NULL::timestamptz, 0, 0),
  -- way/34056445
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0382182::double precision, 34.7583034::double precision, 'דוידוף'::text, NULL::timestamptz, 0, 0),
  -- way/34333834
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0980457::double precision, 34.7886259::double precision, 'ספורטק צפון'::text, NULL::timestamptz, 0, 0),
  -- way/34748041
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0954583::double precision, 34.7936732::double precision, 'גן זינגר'::text, NULL::timestamptz, 0, 0),
  -- way/35148082
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0845794::double precision, 34.7936488::double precision, 'גן פייבל'::text, NULL::timestamptz, 0, 0),
  -- way/35159886
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0859388::double precision, 34.7715981::double precision, 'גן גולדשטיין גורן'::text, NULL::timestamptz, 0, 0),
  -- way/35159932
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0830879::double precision, 34.7695941::double precision, 'גן ערן'::text, NULL::timestamptz, 0, 0),
  -- way/35160039
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.081519::double precision, 34.7696203::double precision, 'גן פינצ''וק'::text, NULL::timestamptz, 0, 0),
  -- way/35169732
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0787248::double precision, 34.7758304::double precision, 'גינת רות'::text, NULL::timestamptz, 0, 0),
  -- way/35193699
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0782706::double precision, 34.7672387::double precision, 'גן לונדון'::text, NULL::timestamptz, 0, 0),
  -- way/35208371
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1179931::double precision, 34.812657::double precision, 'גינת חיים מבורך'::text, NULL::timestamptz, 0, 0),
  -- way/35208625
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1065868::double precision, 34.8120811::double precision, 'לונה פארק'::text, NULL::timestamptz, 0, 0),
  -- way/35418556
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1207031::double precision, 34.8131557::double precision, 'חורשת רוזאניס'::text, NULL::timestamptz, 0, 0),
  -- way/35668110
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.121485::double precision, 34.8366866::double precision, 'פארק מודעי'::text, NULL::timestamptz, 0, 0),
  -- way/36932196
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1675432::double precision, 34.8224479::double precision, 'פארק הרצליה'::text, NULL::timestamptz, 0, 0),
  -- way/37558390
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0666059::double precision, 34.7653209::double precision, 'גן הכובשים'::text, NULL::timestamptz, 0, 0),
  -- way/37558654
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0915047::double precision, 34.7716676::double precision, 'גן העצמאות'::text, NULL::timestamptz, 0, 0),
  -- way/41698720
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0681036::double precision, 34.7968741::double precision, 'גן שדרות ההשכלה'::text, NULL::timestamptz, 0, 0),
  -- way/42567606
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.124808::double precision, 34.8116636::double precision, 'פארק נווה גן'::text, NULL::timestamptz, 0, 0),
  -- way/44851783
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0442797::double precision, 34.7468461::double precision, 'מדרון יפו'::text, NULL::timestamptz, 0, 0),
  -- way/45556106
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0494128::double precision, 34.8230493::double precision, 'הפארק הלאומי'::text, NULL::timestamptz, 0, 0),
  -- way/45834250
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1560405::double precision, 34.8469311::double precision, 'גבעת הפרחים'::text, NULL::timestamptz, 0, 0),
  -- way/45834251
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1569225::double precision, 34.8521066::double precision, 'גן איתן'::text, NULL::timestamptz, 0, 0),
  -- way/47331162
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0319286::double precision, 34.8565591::double precision, 'פארק נוה-סביון'::text, NULL::timestamptz, 0, 0),
  -- way/47331284
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0302936::double precision, 34.8563046::double precision, 'פארק המדע נוה-סביון'::text, NULL::timestamptz, 0, 0),
  -- way/47333406
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0558498::double precision, 34.855874::double precision, 'פארק רייספלד'::text, NULL::timestamptz, 0, 0),
  -- way/48559541
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0651168::double precision, 34.8478812::double precision, 'גן העשרים'::text, NULL::timestamptz, 0, 0),
  -- way/50759464
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0521483::double precision, 34.7949988::double precision, 'פארק התקווה'::text, NULL::timestamptz, 0, 0),
  -- way/51336447
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0392309::double precision, 34.8020895::double precision, 'פארק מנחם בגין'::text, NULL::timestamptz, 0, 0),
  -- way/58020104
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0333661::double precision, 34.7682804::double precision, 'פארק הנוער'::text, NULL::timestamptz, 0, 0),
  -- way/59265443
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0098271::double precision, 34.7407728::double precision, 'גן העיר'::text, NULL::timestamptz, 0, 0),
  -- way/60530863
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0810001::double precision, 34.8032703::double precision, 'גן דוד פרנקפורט'::text, NULL::timestamptz, 0, 0),
  -- way/63331066
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9594622::double precision, 34.8019104::double precision, 'גן הבנים'::text, NULL::timestamptz, 0, 0),
  -- way/64846746
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9319213::double precision, 34.7972879::double precision, 'גן הפעמון'::text, NULL::timestamptz, 0, 0),
  -- way/66427573
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.98562::double precision, 34.782921::double precision, 'גן אחוזת ראשונים על שם אברהם רובינשטיין'::text, NULL::timestamptz, 0, 0),
  -- way/66427577
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9876317::double precision, 34.7842003::double precision, 'גן הברקן'::text, NULL::timestamptz, 0, 0),
  -- way/66985424
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.08952::double precision, 34.8313211::double precision, 'הר הבנים'::text, NULL::timestamptz, 0, 0),
  -- way/69550135
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9722574::double precision, 34.7853562::double precision, 'גן קרית ראשון'::text, NULL::timestamptz, 0, 0),
  -- way/69782030
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9637684::double precision, 34.7815497::double precision, 'גן טירת צבי'::text, NULL::timestamptz, 0, 0),
  -- way/74851526
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0997737::double precision, 34.8368294::double precision, 'פארק הזית'::text, NULL::timestamptz, 0, 0),
  -- way/80390960
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0623135::double precision, 34.8164505::double precision, 'גן שטיצר'::text, NULL::timestamptz, 0, 0),
  -- way/80391217
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.069828::double precision, 34.8149057::double precision, 'גן העליה השניה'::text, NULL::timestamptz, 0, 0),
  -- way/80424700
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0655623::double precision, 34.8186804::double precision, 'גן הלוחמים'::text, NULL::timestamptz, 0, 0),
  -- way/80424717
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0670762::double precision, 34.8142832::double precision, 'גן קושניר'::text, NULL::timestamptz, 0, 0),
  -- way/80798202
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.978744::double precision, 34.7443493::double precision, 'סופרלנד'::text, NULL::timestamptz, 0, 0),
  -- way/82648969
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1263881::double precision, 34.8035634::double precision, 'גן רוזין'::text, NULL::timestamptz, 0, 0),
  -- way/84915181
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0838934::double precision, 34.8281491::double precision, 'גן עקיבא גור'::text, NULL::timestamptz, 0, 0),
  -- way/89155389
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0767312::double precision, 34.8219227::double precision, 'הר הבנים'::text, NULL::timestamptz, 0, 0),
  -- way/90173102
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.12614::double precision, 34.8000088::double precision, 'גן אלפרד ביר'::text, NULL::timestamptz, 0, 0),
  -- way/91599859
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0848594::double precision, 34.7874994::double precision, 'גן גרמניס'::text, NULL::timestamptz, 0, 0),
  -- way/92514896
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9729057::double precision, 34.815974::double precision, 'גן הנעורים'::text, NULL::timestamptz, 0, 0),
  -- way/94702806
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1235761::double precision, 34.8146675::double precision, 'כיכר אביבה אורי'::text, NULL::timestamptz, 0, 0),
  -- way/94704930
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.121218::double precision, 34.8201514::double precision, 'גן ריזפלד'::text, NULL::timestamptz, 0, 0),
  -- way/94832592
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0580273::double precision, 34.855649::double precision, 'גינת המדורגים'::text, NULL::timestamptz, 0, 0),
  -- way/94848175
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1245053::double precision, 34.8190695::double precision, 'גן אהרון'::text, NULL::timestamptz, 0, 0),
  -- way/96294497
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0499135::double precision, 34.8044807::double precision, 'פארק כפר שלם'::text, NULL::timestamptz, 0, 0),
  -- way/97202548
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.114228::double precision, 34.7945677::double precision, 'פארק גלסברג'::text, NULL::timestamptz, 0, 0),
  -- way/97730639
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1296722::double precision, 34.7918813::double precision, 'גן המייסדים'::text, NULL::timestamptz, 0, 0),
  -- way/98096935
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1101019::double precision, 34.7974302::double precision, 'גינת גולדה'::text, NULL::timestamptz, 0, 0),
  -- way/98520934
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1020281::double precision, 34.785529::double precision, 'גן כוכב הצפון'::text, NULL::timestamptz, 0, 0),
  -- way/99000934
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.054298::double precision, 34.8080139::double precision, 'פארק שרני'::text, NULL::timestamptz, 0, 0),
  -- way/99000936
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0568241::double precision, 34.8186183::double precision, 'חורשת אדיס'::text, NULL::timestamptz, 0, 0),
  -- way/99661603
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1056951::double precision, 34.7893841::double precision, 'למד הירוקה'::text, NULL::timestamptz, 0, 0),
  -- way/99661624
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1070374::double precision, 34.7895479::double precision, 'גן ז''ילבר'::text, NULL::timestamptz, 0, 0),
  -- way/100079061
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1281585::double precision, 34.7966349::double precision, 'גן מלקינד'::text, NULL::timestamptz, 0, 0),
  -- way/100599839
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.123627::double precision, 34.799526::double precision, 'גן כצנלסון'::text, NULL::timestamptz, 0, 0),
  -- way/100716124
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1190692::double precision, 34.8211292::double precision, 'גן וייץ'::text, NULL::timestamptz, 0, 0),
  -- way/100763990
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1139822::double precision, 34.8215762::double precision, 'פארק ברלין'::text, NULL::timestamptz, 0, 0),
  -- way/100948744
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1085333::double precision, 34.8216455::double precision, 'גן פרנקפורט'::text, NULL::timestamptz, 0, 0),
  -- way/101365344
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.113261::double precision, 34.8354432::double precision, 'גן סעדיה שושני'::text, NULL::timestamptz, 0, 0),
  -- way/103189606
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1057351::double precision, 34.7770168::double precision, 'פארק חופי רידינג'::text, NULL::timestamptz, 0, 0),
  -- way/103632854
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1088213::double precision, 34.8043227::double precision, 'social workers park'::text, NULL::timestamptz, 0, 0),
  -- way/103632871
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1094711::double precision, 34.8050452::double precision, 'פארק הנדסת חשמל'::text, NULL::timestamptz, 0, 0),
  -- way/103730656
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0682707::double precision, 34.8351597::double precision, 'גן אלי כהן'::text, NULL::timestamptz, 0, 0),
  -- way/103730769
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0740946::double precision, 34.8307038::double precision, 'גן ראול ולנברג'::text, NULL::timestamptz, 0, 0),
  -- way/103730785
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0669798::double precision, 34.8390076::double precision, 'גן התפוצות'::text, NULL::timestamptz, 0, 0),
  -- way/103768525
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0552646::double precision, 34.753607::double precision, 'גן המדרון'::text, NULL::timestamptz, 0, 0),
  -- way/103823180
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0544602::double precision, 34.7545372::double precision, 'גן המוזיאון'::text, NULL::timestamptz, 0, 0),
  -- way/104304038
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0625651::double precision, 34.7602073::double precision, 'פארק צ''ארלס קלור'::text, NULL::timestamptz, 0, 0),
  -- way/104708769
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0821778::double precision, 34.8123468::double precision, 'גן המעגל'::text, NULL::timestamptz, 0, 0),
  -- way/104708772
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0871917::double precision, 34.8184965::double precision, 'גן אברהם'::text, NULL::timestamptz, 0, 0),
  -- way/104708802
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.082281::double precision, 34.8113639::double precision, 'גן שאול'::text, NULL::timestamptz, 0, 0),
  -- way/104708828
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0850183::double precision, 34.8167071::double precision, 'גינת אבטליון'::text, NULL::timestamptz, 0, 0),
  -- way/104799750
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0565647::double precision, 34.7639455::double precision, 'גינת אליפלט'::text, NULL::timestamptz, 0, 0),
  -- way/106289382
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.129411::double precision, 34.806519::double precision, 'אקו פארק גלילות'::text, NULL::timestamptz, 0, 0),
  -- way/107456863
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0269099::double precision, 34.8001096::double precision, 'גן משחקים - השבעה'::text, NULL::timestamptz, 0, 0),
  -- way/107456901
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0036442::double precision, 34.7974581::double precision, 'פארק פרס'::text, NULL::timestamptz, 0, 0),
  -- way/107456924
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0072191::double precision, 34.7854881::double precision, 'מוזיאון חוסמסה יד ל"הגנה"'::text, NULL::timestamptz, 0, 0),
  -- way/108596875
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0802438::double precision, 34.8294414::double precision, 'גינת החרציות'::text, NULL::timestamptz, 0, 0),
  -- way/109519084
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0688558::double precision, 34.8194897::double precision, 'גן אלקס'::text, NULL::timestamptz, 0, 0),
  -- way/109519086
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0728129::double precision, 34.8152207::double precision, 'גן מצפור שלום'::text, NULL::timestamptz, 0, 0),
  -- way/110019958
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0190578::double precision, 34.7717638::double precision, 'גן הרצל (ב'')'::text, NULL::timestamptz, 0, 0),
  -- way/114324060
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0210681::double precision, 34.7731459::double precision, 'גן הרצל (א'')'::text, NULL::timestamptz, 0, 0),
  -- way/116687293
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.012633::double precision, 34.7448493::double precision, 'גן אשכול'::text, NULL::timestamptz, 0, 0),
  -- way/118552804
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9632186::double precision, 34.7787263::double precision, 'פארק החולות'::text, NULL::timestamptz, 0, 0),
  -- way/120060603
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1637815::double precision, 34.8060371::double precision, 'פארק מנור'::text, NULL::timestamptz, 0, 0),
  -- way/120560065
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9728155::double precision, 34.7908223::double precision, 'גן המעיין "עיון קרא"'::text, NULL::timestamptz, 0, 0),
  -- way/121445754
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9750658::double precision, 34.7952363::double precision, 'גן מנהיגים'::text, NULL::timestamptz, 0, 0),
  -- way/124656922
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0894841::double precision, 34.8065081::double precision, 'גן ילין'::text, NULL::timestamptz, 0, 0),
  -- way/129843574
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0770503::double precision, 34.8013965::double precision, 'גינת נהלל'::text, NULL::timestamptz, 0, 0),
  -- way/131382028
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0799607::double precision, 34.8440317::double precision, 'פארק ברוקלין'::text, NULL::timestamptz, 0, 0),
  -- way/131908667
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0202787::double precision, 34.7640653::double precision, 'גן חיל השריון'::text, NULL::timestamptz, 0, 0),
  -- way/131908701
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0185628::double precision, 34.7627822::double precision, 'גן רוסתוילי'::text, NULL::timestamptz, 0, 0),
  -- way/131911063
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0162858::double precision, 34.7654452::double precision, 'גן האמיצים'::text, NULL::timestamptz, 0, 0),
  -- way/131913590
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0151056::double precision, 34.7710802::double precision, 'גן גיורא'::text, NULL::timestamptz, 0, 0),
  -- way/132766644
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.026064::double precision, 34.7756797::double precision, 'גן סיפור - האוצר של צ''מבלו'::text, NULL::timestamptz, 0, 0),
  -- way/132766649
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0269044::double precision, 34.7775676::double precision, 'גן השומר-טרומפלדור'::text, NULL::timestamptz, 0, 0),
  -- way/132766651
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0268824::double precision, 34.77565::double precision, 'גן השומרון'::text, NULL::timestamptz, 0, 0),
  -- way/136525897
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0728116::double precision, 34.8480242::double precision, 'פארק האחדות ע"ש משפחת דהאן'::text, NULL::timestamptz, 0, 0),
  -- way/143105281
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0399715::double precision, 34.7771726::double precision, 'פארק אפוטושו'::text, NULL::timestamptz, 0, 0),
  -- way/143623356
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0579433::double precision, 34.778396::double precision, 'פארק לוינסקי'::text, NULL::timestamptz, 0, 0),
  -- way/145240250
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0176138::double precision, 34.7803071::double precision, 'גן ריינס'::text, NULL::timestamptz, 0, 0),
  -- way/145251041
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0186019::double precision, 34.7961471::double precision, 'פארק נוה ארזים'::text, NULL::timestamptz, 0, 0),
  -- way/145531741
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0835694::double precision, 34.8374298::double precision, 'גן 93'::text, NULL::timestamptz, 0, 0),
  -- way/145542211
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0948376::double precision, 34.8318535::double precision, 'גן קדושי בבל'::text, NULL::timestamptz, 0, 0),
  -- way/145542249
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0986255::double precision, 34.8405962::double precision, 'גן חזני'::text, NULL::timestamptz, 0, 0),
  -- way/145542263
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0974779::double precision, 34.8403426::double precision, 'גן שפירא'::text, NULL::timestamptz, 0, 0),
  -- way/149384939
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0836251::double precision, 34.7835696::double precision, 'גן א.ל. זיסו'::text, NULL::timestamptz, 0, 0),
  -- way/152185115
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0449763::double precision, 34.7703262::double precision, 'פארק החורשות'::text, NULL::timestamptz, 0, 0),
  -- way/153085962
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1692935::double precision, 34.8552423::double precision, 'פארק רבין'::text, NULL::timestamptz, 0, 0),
  -- way/154716346
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0632082::double precision, 34.8072009::double precision, 'גן חיל האויר'::text, NULL::timestamptz, 0, 0),
  -- way/156003813
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0112346::double precision, 34.7953948::double precision, 'מרבד הקסמים'::text, NULL::timestamptz, 0, 0),
  -- way/157447936
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0882608::double precision, 34.812081::double precision, 'גן שקדיה'::text, NULL::timestamptz, 0, 0),
  -- way/157463441
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0759402::double precision, 34.8045132::double precision, 'גן התקומה'::text, NULL::timestamptz, 0, 0),
  -- way/157464151
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0663024::double precision, 34.813163::double precision, 'פארק גבעתיים'::text, NULL::timestamptz, 0, 0),
  -- way/157467398
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0775783::double precision, 34.8054424::double precision, 'גן מאיר ויקטור'::text, NULL::timestamptz, 0, 0),
  -- way/157467403
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0778107::double precision, 34.8125323::double precision, 'גינת יניב וייסר'::text, NULL::timestamptz, 0, 0),
  -- way/157467404
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0763253::double precision, 34.8110359::double precision, 'גן הזיכרון'::text, NULL::timestamptz, 0, 0),
  -- way/157470641
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0761265::double precision, 34.813112::double precision, 'גן אהרון'::text, NULL::timestamptz, 0, 0),
  -- way/157470653
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0744065::double precision, 34.8139178::double precision, 'גן שולמית'::text, NULL::timestamptz, 0, 0),
  -- way/157472544
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0747586::double precision, 34.8078851::double precision, 'המלבן'::text, NULL::timestamptz, 0, 0),
  -- way/157509492
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0815074::double precision, 34.7948068::double precision, 'גן וולובלסקי קרני'::text, NULL::timestamptz, 0, 0),
  -- way/157516442
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.071722::double precision, 34.8308258::double precision, 'פארק דוד'::text, NULL::timestamptz, 0, 0),
  -- way/162497600
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9966071::double precision, 34.7679235::double precision, 'גן הבנים'::text, NULL::timestamptz, 0, 0),
  -- way/162497661
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9978551::double precision, 34.771657::double precision, 'גן משעול ענבר'::text, NULL::timestamptz, 0, 0),
  -- way/162939429
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9629527::double precision, 34.8040657::double precision, 'גן העיר'::text, NULL::timestamptz, 0, 0),
  -- way/164248168
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0193025::double precision, 34.7603389::double precision, 'פארק שכונת רמת יוסף'::text, NULL::timestamptz, 0, 0),
  -- way/164248170
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0190309::double precision, 34.7570192::double precision, 'גן משה דיין'::text, NULL::timestamptz, 0, 0),
  -- way/164823709
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9669692::double precision, 34.7723838::double precision, 'גן הפסנטר'::text, NULL::timestamptz, 0, 0),
  -- way/164826516
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9655918::double precision, 34.7758144::double precision, 'גן המפוחית'::text, NULL::timestamptz, 0, 0),
  -- way/164827122
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9657252::double precision, 34.7736674::double precision, 'גן נאות אשלים'::text, NULL::timestamptz, 0, 0),
  -- way/164935059
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9623137::double precision, 34.7732351::double precision, 'נן החליל'::text, NULL::timestamptz, 0, 0),
  -- way/165103250
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0034307::double precision, 34.7646776::double precision, 'ארבע ארצות'::text, NULL::timestamptz, 0, 0),
  -- way/165103251
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0022533::double precision, 34.7670693::double precision, 'גן ג''נאו'::text, NULL::timestamptz, 0, 0),
  -- way/165120229
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0040065::double precision, 34.7672712::double precision, 'גן אהרונוביץ'''::text, NULL::timestamptz, 0, 0),
  -- way/165120232
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.00516::double precision, 34.7641411::double precision, 'גן הסנהדרין'::text, NULL::timestamptz, 0, 0),
  -- way/165503005
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9662734::double precision, 34.7824313::double precision, 'גן דליה'::text, NULL::timestamptz, 0, 0),
  -- way/165503036
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9670657::double precision, 34.7793721::double precision, 'גן גנוסר'::text, NULL::timestamptz, 0, 0),
  -- way/165503039
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9650148::double precision, 34.7821464::double precision, 'גן דן'::text, NULL::timestamptz, 0, 0),
  -- way/165522691
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9625495::double precision, 34.7809359::double precision, 'גן כפר חיטים'::text, NULL::timestamptz, 0, 0),
  -- way/165523937
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9644248::double precision, 34.7797645::double precision, 'גן שדה נחום'::text, NULL::timestamptz, 0, 0),
  -- way/165597766
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9615258::double precision, 34.779899::double precision, 'גן שדמות דבורה'::text, NULL::timestamptz, 0, 0),
  -- way/165597771
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9609034::double precision, 34.7781118::double precision, 'גן ניר דוד'::text, NULL::timestamptz, 0, 0),
  -- way/166029237
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9693185::double precision, 34.7651389::double precision, 'גן פרס נובל'::text, NULL::timestamptz, 0, 0),
  -- way/166320619
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.970412::double precision, 34.7617727::double precision, 'גן בוריס פסטרנק'::text, NULL::timestamptz, 0, 0),
  -- way/166320627
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.967569::double precision, 34.7641177::double precision, 'גן סיפורי אגדות'::text, NULL::timestamptz, 0, 0),
  -- way/166320637
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.967222::double precision, 34.7679275::double precision, 'גן רבי איזידור יצחק'::text, NULL::timestamptz, 0, 0),
  -- way/166675973
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0764133::double precision, 34.852676::double precision, 'פארק דקר'::text, NULL::timestamptz, 0, 0),
  -- way/166675982
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0737987::double precision, 34.8542719::double precision, 'פארק רמון'::text, NULL::timestamptz, 0, 0),
  -- way/166859706
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9815551::double precision, 34.7625771::double precision, 'גן נווה דקלים'::text, NULL::timestamptz, 0, 0),
  -- way/167162586
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0688316::double precision, 34.8059918::double precision, 'גן סולד'::text, NULL::timestamptz, 0, 0),
  -- way/167164339
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0733409::double precision, 34.8039475::double precision, 'גן הבנים'::text, NULL::timestamptz, 0, 0),
  -- way/175067126
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0784754::double precision, 34.8085588::double precision, 'גן יפה'::text, NULL::timestamptz, 0, 0),
  -- way/176439124
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0541119::double precision, 34.8500335::double precision, 'גן ליטוינסקי'::text, NULL::timestamptz, 0, 0),
  -- way/179925297
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1497299::double precision, 34.8342953::double precision, 'Gan Alof'::text, NULL::timestamptz, 0, 0),
  -- way/182814098
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1714483::double precision, 34.8490653::double precision, 'גן אורן'::text, NULL::timestamptz, 0, 0),
  -- way/182818349
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0413449::double precision, 34.7477156::double precision, 'גינת טולוז'::text, NULL::timestamptz, 0, 0),
  -- way/183250785
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0608037::double precision, 34.789034::double precision, 'פארק גלית'::text, NULL::timestamptz, 0, 0),
  -- way/185541059
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9824306::double precision, 34.7625369::double precision, 'פארק היקפי נווה דקלים'::text, NULL::timestamptz, 0, 0),
  -- way/189510889
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0647058::double precision, 34.8250826::double precision, 'גן יעקבסון'::text, NULL::timestamptz, 0, 0),
  -- way/192923486
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0685299::double precision, 34.8314341::double precision, 'גן הנ״ד'::text, NULL::timestamptz, 0, 0),
  -- way/194266647
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0095066::double precision, 34.7670509::double precision, 'גן קרית עבודה'::text, NULL::timestamptz, 0, 0),
  -- way/194266652
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0109111::double precision, 34.7724645::double precision, 'גן חסידי אומות העולם'::text, NULL::timestamptz, 0, 0),
  -- way/197396729
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9366032::double precision, 34.8351086::double precision, 'כיכר אביבי'::text, NULL::timestamptz, 0, 0),
  -- way/197398444
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9408413::double precision, 34.8433405::double precision, 'פארק חתני פרס ישראל'::text, NULL::timestamptz, 0, 0),
  -- way/197806537
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9415822::double precision, 34.8464652::double precision, 'פארק חתני פרס ישראל'::text, NULL::timestamptz, 0, 0),
  -- way/198438847
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0622268::double precision, 34.7992333::double precision, 'גן ליידי שרה'::text, NULL::timestamptz, 0, 0),
  -- way/201791056
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0182735::double precision, 34.7651243::double precision, 'גן הנחלאים'::text, NULL::timestamptz, 0, 0),
  -- way/202750057
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9525877::double precision, 34.8121553::double precision, 'גן מישור הנוף'::text, NULL::timestamptz, 0, 0),
  -- way/203219827
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0830576::double precision, 34.7897849::double precision, 'גן גורדון'::text, NULL::timestamptz, 0, 0),
  -- way/211728831
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.04027::double precision, 34.7614978::double precision, 'היינריך היינה'::text, NULL::timestamptz, 0, 0),
  -- way/214312214
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9761901::double precision, 34.7906058::double precision, 'פארק קורט'::text, NULL::timestamptz, 0, 0),
  -- way/214312216
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9771995::double precision, 34.7857688::double precision, 'ספורט-כיף'::text, NULL::timestamptz, 0, 0),
  -- way/218871499
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0682611::double precision, 34.7813118::double precision, 'גן קריית ספר'::text, NULL::timestamptz, 0, 0),
  -- way/220313572
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0859051::double precision, 34.83206::double precision, 'גן קדושי ורשה'::text, NULL::timestamptz, 0, 0),
  -- way/220693246
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1894939::double precision, 34.8580608::double precision, 'גן התפוז'::text, NULL::timestamptz, 0, 0),
  -- way/221256003
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1607428::double precision, 34.8057006::double precision, 'פארק הספורט'::text, NULL::timestamptz, 0, 0),
  -- way/222471243
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.134531::double precision, 34.8393104::double precision, 'גן סייפן'::text, NULL::timestamptz, 0, 0),
  -- way/222471729
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1425314::double precision, 34.8411931::double precision, 'גן אברהם'::text, NULL::timestamptz, 0, 0),
  -- way/222471733
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1411609::double precision, 34.839022::double precision, 'גינת אח"י דקר'::text, NULL::timestamptz, 0, 0),
  -- way/222471734
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1436237::double precision, 34.8404192::double precision, 'גינת רד"ק'::text, NULL::timestamptz, 0, 0),
  -- way/222477086
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1461209::double precision, 34.8338103::double precision, 'גן הבנים'::text, NULL::timestamptz, 0, 0),
  -- way/222534510
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0750237::double precision, 34.8176565::double precision, 'גן מרים'::text, NULL::timestamptz, 0, 0),
  -- way/222730271
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9608527::double precision, 34.7993336::double precision, 'גן עזריה פרשקובסקי'::text, NULL::timestamptz, 0, 0),
  -- way/222858637
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.092559::double precision, 34.8206057::double precision, 'גן חיה ציפמן'::text, NULL::timestamptz, 0, 0),
  -- way/223105557
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0180507::double precision, 34.7504708::double precision, 'גן דניאל'::text, NULL::timestamptz, 0, 0),
  -- way/225248771
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9334256::double precision, 34.791992::double precision, 'חורשת המייסדים'::text, NULL::timestamptz, 0, 0),
  -- way/225345488
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0654815::double precision, 34.8576679::double precision, 'פארק אביבה ורשה'::text, NULL::timestamptz, 0, 0),
  -- way/226356264
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9333962::double precision, 34.7949098::double precision, 'גרנד קוויל'::text, NULL::timestamptz, 0, 0),
  -- way/229138081
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0747645::double precision, 34.8543403::double precision, 'כיכר רועי קליין'::text, NULL::timestamptz, 0, 0),
  -- way/229138784
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0780135::double precision, 34.8543733::double precision, 'פארק המוזיקה'::text, NULL::timestamptz, 0, 0),
  -- way/231854937
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0239991::double precision, 34.7566571::double precision, 'גינת הזית'::text, NULL::timestamptz, 0, 0),
  -- way/232710489
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0349558::double precision, 34.7572634::double precision, 'גן ברניקר'::text, NULL::timestamptz, 0, 0),
  -- way/232710491
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0324329::double precision, 34.7532471::double precision, 'מורל'::text, NULL::timestamptz, 0, 0),
  -- way/232710492
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0406241::double precision, 34.7609008::double precision, 'נוזהה'::text, NULL::timestamptz, 0, 0),
  -- way/232710493
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0347871::double precision, 34.7583638::double precision, 'סומקן'::text, NULL::timestamptz, 0, 0),
  -- way/232710494
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0332421::double precision, 34.7588864::double precision, 'סומקן קטן'::text, NULL::timestamptz, 0, 0),
  -- way/233031458
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0094716::double precision, 34.7737818::double precision, 'הגן הקוריאני'::text, NULL::timestamptz, 0, 0),
  -- way/233032733
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0109072::double precision, 34.7701782::double precision, 'גן ספור - ספור מהלב'::text, NULL::timestamptz, 0, 0),
  -- way/234184316
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.025377::double precision, 34.7566054::double precision, 'חורשת אליהו'::text, NULL::timestamptz, 0, 0),
  -- way/234184320
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0204775::double precision, 34.7499706::double precision, 'גן בני ברית'::text, NULL::timestamptz, 0, 0),
  -- way/236862403
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0166477::double precision, 34.7414423::double precision, 'פארק העירייה'::text, NULL::timestamptz, 0, 0),
  -- way/237501770
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1611123::double precision, 34.8583306::double precision, 'גינת מיכל'::text, NULL::timestamptz, 0, 0),
  -- way/237501789
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1748792::double precision, 34.8500937::double precision, 'גן די נור'::text, NULL::timestamptz, 0, 0),
  -- way/237501805
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1617121::double precision, 34.8595946::double precision, 'גן מנשה'::text, NULL::timestamptz, 0, 0),
  -- way/240195192
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0390056::double precision, 34.7598364::double precision, 'גן נחל שור'::text, NULL::timestamptz, 0, 0),
  -- way/243412507
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0846066::double precision, 34.8227895::double precision, 'גינת בית שמאי'::text, NULL::timestamptz, 0, 0),
  -- way/245834994
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0199565::double precision, 34.7478634::double precision, 'גן מפקורה'::text, NULL::timestamptz, 0, 0),
  -- way/247105460
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0919772::double precision, 34.8207726::double precision, 'גן סביון'::text, NULL::timestamptz, 0, 0),
  -- way/247161583
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.16871::double precision, 34.8404979::double precision, 'גן בית ראשונים'::text, NULL::timestamptz, 0, 0),
  -- way/251561023
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1091486::double precision, 34.7910895::double precision, 'גינה לזכר כ"ג יורדי הסירה'::text, NULL::timestamptz, 0, 0),
  -- way/253584205
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9652616::double precision, 34.8038729::double precision, 'גן אשר לוין'::text, NULL::timestamptz, 0, 0),
  -- way/253586792
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9615069::double precision, 34.8104352::double precision, 'גן הפרדס'::text, NULL::timestamptz, 0, 0),
  -- way/253692089
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9579017::double precision, 34.8030969::double precision, 'גן רופין'::text, NULL::timestamptz, 0, 0),
  -- way/253708955
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9631495::double precision, 34.7910523::double precision, 'גן נאור בני'::text, NULL::timestamptz, 0, 0),
  -- way/253708960
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9684458::double precision, 34.7971357::double precision, 'גן פסח קובל'::text, NULL::timestamptz, 0, 0),
  -- way/253708999
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9651348::double precision, 34.8260162::double precision, 'גן בעברית'::text, NULL::timestamptz, 0, 0),
  -- way/253711649
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9613645::double precision, 34.7937941::double precision, 'גן שפטל'::text, NULL::timestamptz, 0, 0),
  -- way/253769058
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9536316::double precision, 34.8216046::double precision, 'גן שער למזרח'::text, NULL::timestamptz, 0, 0),
  -- way/253769060
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9514837::double precision, 34.8210413::double precision, 'גן השומר הצעיר'::text, NULL::timestamptz, 0, 0),
  -- way/253769070
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9508084::double precision, 34.8224972::double precision, 'גן יוסף הנשיא'::text, NULL::timestamptz, 0, 0),
  -- way/253769071
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.952293::double precision, 34.8193583::double precision, 'גן ישורון'::text, NULL::timestamptz, 0, 0),
  -- way/253771516
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9496274::double precision, 34.8186417::double precision, 'גן נחמיה'::text, NULL::timestamptz, 0, 0),
  -- way/253771522
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9576352::double precision, 34.8197553::double precision, 'גן ליאור'::text, NULL::timestamptz, 0, 0),
  -- way/253771530
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9610195::double precision, 34.8222191::double precision, 'פארק ירושלים'::text, NULL::timestamptz, 0, 0),
  -- way/253771537
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9584596::double precision, 34.8175722::double precision, 'גן הקוקיה'::text, NULL::timestamptz, 0, 0),
  -- way/253789082
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.954158::double precision, 34.8086393::double precision, 'גן הפועל המזרחי'::text, NULL::timestamptz, 0, 0),
  -- way/253789084
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9514518::double precision, 34.8075591::double precision, 'חורשת הפיס'::text, NULL::timestamptz, 0, 0),
  -- way/253810350
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9553312::double precision, 34.8206759::double precision, 'גן זוגות צעירים'::text, NULL::timestamptz, 0, 0),
  -- way/253837943
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9456554::double precision, 34.8287742::double precision, 'גן סעדיה גאון'::text, NULL::timestamptz, 0, 0),
  -- way/253911962
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9651833::double precision, 34.8203156::double precision, 'HaAhad Asar park'::text, NULL::timestamptz, 0, 0),
  -- way/253988519
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.168281::double precision, 34.8512344::double precision, 'גן בן שפר'::text, NULL::timestamptz, 0, 0),
  -- way/253996933
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9590896::double precision, 34.8024984::double precision, 'גן באר נחום'::text, NULL::timestamptz, 0, 0),
  -- way/254036319
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.971839::double precision, 34.8119653::double precision, 'גן יעקובזון'::text, NULL::timestamptz, 0, 0),
  -- way/254036325
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9693026::double precision, 34.8164024::double precision, 'גן פופל'::text, NULL::timestamptz, 0, 0),
  -- way/254043031
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9586469::double precision, 34.8161494::double precision, 'שדרת החוחית'::text, NULL::timestamptz, 0, 0),
  -- way/254969368
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0636753::double precision, 34.8576581::double precision, 'כיכר צ''נדו'::text, NULL::timestamptz, 0, 0),
  -- way/256195918
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0473142::double precision, 34.7663691::double precision, 'גן אבו נבוט'::text, NULL::timestamptz, 0, 0),
  -- way/256196149
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0499545::double precision, 34.7704464::double precision, 'הגן הזואולוגי'::text, NULL::timestamptz, 0, 0),
  -- way/261008624
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0608646::double precision, 34.7969597::double precision, 'שדרות יד לבנים'::text, NULL::timestamptz, 0, 0),
  -- way/261481054
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0557506::double precision, 34.7965959::double precision, 'גן גונדה'::text, NULL::timestamptz, 0, 0),
  -- way/262516530
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0692467::double precision, 34.8008228::double precision, 'ריקליס'::text, NULL::timestamptz, 0, 0),
  -- way/263141874
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1937906::double precision, 34.8503518::double precision, 'גן מנחם בגין'::text, NULL::timestamptz, 0, 0),
  -- way/276717721
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1363505::double precision, 34.8372478::double precision, 'גן סמדר'::text, NULL::timestamptz, 0, 0),
  -- way/282992834
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0496795::double precision, 34.7605252::double precision, 'גן העם הבולגרי'::text, NULL::timestamptz, 0, 0),
  -- way/287515766
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.130269::double precision, 34.8546021::double precision, 'פרק הנביאים'::text, NULL::timestamptz, 0, 0),
  -- way/288050346
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0724174::double precision, 34.7866705::double precision, 'פארק גני שרונה'::text, NULL::timestamptz, 0, 0),
  -- way/292684389
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0673212::double precision, 34.8267802::double precision, 'גן יקיר'::text, NULL::timestamptz, 0, 0),
  -- way/295849276
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0497151::double precision, 34.8487662::double precision, 'גן הפסלים'::text, NULL::timestamptz, 0, 0),
  -- way/297191729
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0173462::double precision, 34.7466108::double precision, 'גן ירושלמי'::text, NULL::timestamptz, 0, 0),
  -- way/298548989
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.165133::double precision, 34.8515167::double precision, 'גן עידן'::text, NULL::timestamptz, 0, 0),
  -- way/303723074
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1328294::double precision, 34.840437::double precision, 'גן יהושוע טהון'::text, NULL::timestamptz, 0, 0),
  -- way/303723077
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1498167::double precision, 34.8419747::double precision, 'גן הטבק'::text, NULL::timestamptz, 0, 0),
  -- way/304049814
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1679434::double precision, 34.8346583::double precision, 'גינת אהרון חרסינה'::text, NULL::timestamptz, 0, 0),
  -- way/334908850
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0815299::double precision, 34.8241177::double precision, 'הר הארנבות'::text, NULL::timestamptz, 0, 0),
  -- way/337460998
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9347776::double precision, 34.860802::double precision, 'גן גנדי'::text, NULL::timestamptz, 0, 0),
  -- way/339423132
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.076282::double precision, 34.854098::double precision, 'פארק אלקנה'::text, NULL::timestamptz, 0, 0),
  -- way/340255760
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0744266::double precision, 34.7841719::double precision, 'גן ג''רי פנסר'::text, NULL::timestamptz, 0, 0),
  -- way/341013245
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0496951::double precision, 34.8152483::double precision, 'כיכר הרב פרדס'::text, NULL::timestamptz, 0, 0),
  -- way/348394148
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.062405::double precision, 34.8262405::double precision, 'שדרות הקונגרס'::text, NULL::timestamptz, 0, 0),
  -- way/348748591
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0654324::double precision, 34.8314449::double precision, 'גן תהילה'::text, NULL::timestamptz, 0, 0),
  -- way/348774001
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0588056::double precision, 34.8326218::double precision, 'גן האם'::text, NULL::timestamptz, 0, 0),
  -- way/358440373
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0850889::double precision, 34.820591::double precision, 'גן עמירם'::text, NULL::timestamptz, 0, 0),
  -- way/362314995
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0853301::double precision, 34.7837759::double precision, 'גן ההסתדרות'::text, NULL::timestamptz, 0, 0),
  -- way/367879713
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0239963::double precision, 34.8572422::double precision, 'גן מלווקי'::text, NULL::timestamptz, 0, 0),
  -- way/369413530
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9834444::double precision, 34.7768641::double precision, 'גו אבני החושן'::text, NULL::timestamptz, 0, 0),
  -- way/369752104
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0247698::double precision, 34.8530825::double precision, 'גן התשעה'::text, NULL::timestamptz, 0, 0),
  -- way/370074338
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0872648::double precision, 34.7918846::double precision, 'גן אברהם'::text, NULL::timestamptz, 0, 0),
  -- way/374296957
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9625156::double precision, 34.7990168::double precision, 'גן המכבי'::text, NULL::timestamptz, 0, 0),
  -- way/374561819
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9553061::double precision, 34.8044753::double precision, 'גן אבי האסירים'::text, NULL::timestamptz, 0, 0),
  -- way/375006176
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9556758::double precision, 34.8061261::double precision, 'גן סמילנסקי'::text, NULL::timestamptz, 0, 0),
  -- way/375006177
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9574755::double precision, 34.807007::double precision, 'גן אוסטשינסקי'::text, NULL::timestamptz, 0, 0),
  -- way/376532928
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0482256::double precision, 34.7557278::double precision, 'גן מריצה'::text, NULL::timestamptz, 0, 0),
  -- way/381829664
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9689526::double precision, 34.8237205::double precision, 'גן עין דוד'::text, NULL::timestamptz, 0, 0),
  -- way/384711845
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9399918::double precision, 34.8332396::double precision, 'פארק המושבה'::text, NULL::timestamptz, 0, 0),
  -- way/384903929
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.93004::double precision, 34.8316244::double precision, 'פארק חוטר'::text, NULL::timestamptz, 0, 0),
  -- way/385286854
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9344216::double precision, 34.8006556::double precision, 'ספורטק'::text, NULL::timestamptz, 0, 0),
  -- way/385298853
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9665041::double precision, 34.7808442::double precision, 'גן הבונים'::text, NULL::timestamptz, 0, 0),
  -- way/388331490
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9567802::double precision, 34.7965385::double precision, 'גן המוסיקה'::text, NULL::timestamptz, 0, 0),
  -- way/388524582
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1695936::double precision, 34.8574489::double precision, 'חורשת ניסנוב'::text, NULL::timestamptz, 0, 0),
  -- way/389271422
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1804401::double precision, 34.8571123::double precision, 'גן סחלב'::text, NULL::timestamptz, 0, 0),
  -- way/389769463
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0304627::double precision, 34.8208663::double precision, 'פארק אריאל שרון'::text, NULL::timestamptz, 0, 0),
  -- way/391972520
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.186662::double precision, 34.8578633::double precision, 'גן הכוכב'::text, NULL::timestamptz, 0, 0),
  -- way/397963490
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.982299::double precision, 34.7796791::double precision, 'גן מונדריאן'::text, NULL::timestamptz, 0, 0),
  -- way/398580200
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9342238::double precision, 34.8359209::double precision, 'גן גני מנחם'::text, NULL::timestamptz, 0, 0),
  -- way/400632484
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.943195::double precision, 34.8384719::double precision, 'גן החייל'::text, NULL::timestamptz, 0, 0),
  -- way/401479552
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9670345::double precision, 34.776635::double precision, 'גן האורגן'::text, NULL::timestamptz, 0, 0),
  -- way/402645580
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0020961::double precision, 34.734747::double precision, 'גן הטיילת העליונה ב חוף הים'::text, NULL::timestamptz, 0, 0),
  -- way/403159177
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9723147::double precision, 34.7821241::double precision, 'גן הסיתוונית'::text, NULL::timestamptz, 0, 0),
  -- way/407022909
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9768223::double precision, 34.7844405::double precision, 'פארק ערים תאומות'::text, NULL::timestamptz, 0, 0),
  -- way/409590658
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9665961::double precision, 34.7902571::double precision, 'גן הצרפתי'::text, NULL::timestamptz, 0, 0),
  -- way/409590659
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.958668::double precision, 34.7911234::double precision, 'גן נווה הלל'::text, NULL::timestamptz, 0, 0),
  -- way/409590660
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9600802::double precision, 34.7875818::double precision, 'גן שפרינצק'::text, NULL::timestamptz, 0, 0),
  -- way/412683773
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9812196::double precision, 34.7822139::double precision, 'גן ציפורים ופרפרים'::text, NULL::timestamptz, 0, 0),
  -- way/414504692
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1399683::double precision, 34.8458175::double precision, 'פארק רמת השרון'::text, NULL::timestamptz, 0, 0),
  -- way/416509341
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1072489::double precision, 34.7943585::double precision, 'גינת החבלים'::text, NULL::timestamptz, 0, 0),
  -- way/419777736
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.968884::double precision, 34.8017373::double precision, 'גן שפינוזה'::text, NULL::timestamptz, 0, 0),
  -- way/421796959
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9790629::double precision, 34.7752787::double precision, 'גן ה"אמצע"'::text, NULL::timestamptz, 0, 0),
  -- way/425909760
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9713135::double precision, 34.8028801::double precision, 'גן חברושים'::text, NULL::timestamptz, 0, 0),
  -- way/426008141
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0284419::double precision, 34.7987218::double precision, 'פארק אזור'::text, NULL::timestamptz, 0, 0),
  -- way/428475583
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1628812::double precision, 34.8298729::double precision, 'גינה ציבורית'::text, NULL::timestamptz, 0, 0),
  -- way/442749407
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0751241::double precision, 34.7893173::double precision, 'עיר הומיה'::text, NULL::timestamptz, 0, 0),
  -- way/446289234
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9598292::double precision, 34.7936435::double precision, 'גן ד"ר אברהם כץ'::text, NULL::timestamptz, 0, 0),
  -- way/446289238
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.959266::double precision, 34.7938984::double precision, 'גן בוקובינה'::text, NULL::timestamptz, 0, 0),
  -- way/446289240
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9586771::double precision, 34.7937489::double precision, 'גן האם'::text, NULL::timestamptz, 0, 0),
  -- way/458524807
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9966869::double precision, 34.7469337::double precision, 'פרק אחוזת נווה חוף'::text, NULL::timestamptz, 0, 0),
  -- way/461665062
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0616932::double precision, 34.7970539::double precision, 'Bat Zion Community Garden'::text, NULL::timestamptz, 0, 0),
  -- way/463614054
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.97952::double precision, 34.7821256::double precision, 'sun dial park'::text, NULL::timestamptz, 0, 0),
  -- way/468018902
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1679526::double precision, 34.8320788::double precision, 'גינת רועי קליין'::text, NULL::timestamptz, 0, 0),
  -- way/470773720
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0945101::double precision, 34.8049063::double precision, 'מרכז צפרות ראש ציפור'::text, NULL::timestamptz, 0, 0),
  -- way/471509533
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0237687::double precision, 34.7524847::double precision, 'גן רבין'::text, NULL::timestamptz, 0, 0),
  -- way/474830496
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9736369::double precision, 34.7712177::double precision, 'גן קלישר'::text, NULL::timestamptz, 0, 0),
  -- way/475260135
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9775108::double precision, 34.7757792::double precision, 'גן הנגיד'::text, NULL::timestamptz, 0, 0),
  -- way/475267776
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9759045::double precision, 34.77596::double precision, 'גן אבן גבירול'::text, NULL::timestamptz, 0, 0),
  -- way/484377557
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9592583::double precision, 34.8034365::double precision, 'גן טיומקין'::text, NULL::timestamptz, 0, 0),
  -- way/486986919
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0607174::double precision, 34.8344467::double precision, 'Dog Patch'::text, NULL::timestamptz, 0, 0),
  -- way/486986944
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0607576::double precision, 34.8193185::double precision, 'גן טבנקין'::text, NULL::timestamptz, 0, 0),
  -- way/487119143
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9655972::double precision, 34.7974676::double precision, 'גן הדגל העברי'::text, NULL::timestamptz, 0, 0),
  -- way/490042359
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9798755::double precision, 34.7731433::double precision, 'גן שלוניסקי'::text, NULL::timestamptz, 0, 0),
  -- way/490050081
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9792454::double precision, 34.7727869::double precision, 'גינת מרטין בובר'::text, NULL::timestamptz, 0, 0),
  -- way/490297643
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1644986::double precision, 34.8378075::double precision, 'גינת גל'::text, NULL::timestamptz, 0, 0),
  -- way/499223865
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9692761::double precision, 34.8055692::double precision, 'גן בן זאב'::text, NULL::timestamptz, 0, 0),
  -- way/499433113
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1946528::double precision, 34.8546598::double precision, 'גן קרית שרת'::text, NULL::timestamptz, 0, 0),
  -- way/508942605
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0862692::double precision, 34.8138323::double precision, 'גן המלך דוד'::text, NULL::timestamptz, 0, 0),
  -- way/518398396
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1371066::double precision, 34.8452224::double precision, 'יער ילדי השואה'::text, NULL::timestamptz, 0, 0),
  -- way/524146274
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9650484::double precision, 34.794545::double precision, 'גן ה-י"א'::text, NULL::timestamptz, 0, 0),
  -- way/533732111
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9745911::double precision, 34.7693319::double precision, 'גן אלתרמן'::text, NULL::timestamptz, 0, 0),
  -- way/539590901
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.98152::double precision, 34.7839424::double precision, 'גן פנינת הים'::text, NULL::timestamptz, 0, 0),
  -- way/539590907
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9798369::double precision, 34.7841672::double precision, 'גן מבצע חירם'::text, NULL::timestamptz, 0, 0),
  -- way/539903993
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0787925::double precision, 34.8106182::double precision, 'פארק המכתש'::text, NULL::timestamptz, 0, 0),
  -- way/541042875
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9688402::double precision, 34.8215876::double precision, 'גן רפפורט'::text, NULL::timestamptz, 0, 0),
  -- way/543840025
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9999416::double precision, 34.7702839::double precision, 'גן הצנחנים'::text, NULL::timestamptz, 0, 0),
  -- way/543884576
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0650886::double precision, 34.8222481::double precision, 'Hasar Moshe garden'::text, NULL::timestamptz, 0, 0),
  -- way/543888241
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0665283::double precision, 34.8275122::double precision, 'גן תל חי'::text, NULL::timestamptz, 0, 0),
  -- way/543888242
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0651186::double precision, 34.8273785::double precision, 'גן דרור'::text, NULL::timestamptz, 0, 0),
  -- way/543959533
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0771114::double precision, 34.8174633::double precision, 'Guzman Park'::text, NULL::timestamptz, 0, 0),
  -- way/544342409
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0695657::double precision, 34.8218395::double precision, 'Book memorial park'::text, NULL::timestamptz, 0, 0),
  -- way/544870794
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9628163::double precision, 34.7948544::double precision, 'גן השדה'::text, NULL::timestamptz, 0, 0),
  -- way/547968601
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0292014::double precision, 34.7995656::double precision, 'האיכרים'::text, NULL::timestamptz, 0, 0),
  -- way/548188235
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9526866::double precision, 34.8065119::double precision, 'גן סמילנסקי - בר אילן'::text, NULL::timestamptz, 0, 0),
  -- way/548502813
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9618107::double precision, 34.7751145::double precision, 'גן חומה ומגדל'::text, NULL::timestamptz, 0, 0),
  -- way/548505427
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.969361::double precision, 34.7909816::double precision, 'גן ע"ש (ליזרוביץ) אלרן "ממושי אל"מ אברהם"'::text, NULL::timestamptz, 0, 0),
  -- way/551421086
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0596235::double precision, 34.8033214::double precision, 'גן ברנט'::text, NULL::timestamptz, 0, 0),
  -- way/551423533
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0646837::double precision, 34.805419::double precision, 'גן ילדי טהרן'::text, NULL::timestamptz, 0, 0),
  -- way/551425032
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0673526::double precision, 34.8041545::double precision, 'פארק תיאטרון גבעתיים'::text, NULL::timestamptz, 0, 0),
  -- way/551427745
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0682304::double precision, 34.8035966::double precision, 'גן ההגנה'::text, NULL::timestamptz, 0, 0),
  -- way/553574960
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9622517::double precision, 34.7895639::double precision, 'גן הגליל'::text, NULL::timestamptz, 0, 0),
  -- way/555923909
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0603195::double precision, 34.814238::double precision, 'גן ילדי הגנים'::text, NULL::timestamptz, 0, 0),
  -- way/556577629
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1651519::double precision, 34.8356019::double precision, 'Pat Garden'::text, NULL::timestamptz, 0, 0),
  -- way/556577826
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1651868::double precision, 34.8349848::double precision, 'Sarig Garden'::text, NULL::timestamptz, 0, 0),
  -- way/566347079
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9762865::double precision, 34.7878206::double precision, 'אמפיפארק'::text, NULL::timestamptz, 0, 0),
  -- way/567468996
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1197765::double precision, 34.7990593::double precision, 'גן יוסף פוליטי'::text, NULL::timestamptz, 0, 0),
  -- way/577488540
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0612953::double precision, 34.7943011::double precision, 'פארק גלסברג'::text, NULL::timestamptz, 0, 0),
  -- way/577488541
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0501394::double precision, 34.8158613::double precision, 'גן הבנים'::text, NULL::timestamptz, 0, 0),
  -- way/592464079
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.144175::double precision, 34.8365174::double precision, 'גן הראשונים'::text, NULL::timestamptz, 0, 0),
  -- way/597301059
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0561271::double precision, 34.8447942::double precision, 'פארק חיים קונוביץ'::text, NULL::timestamptz, 0, 0),
  -- way/603665974
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9764431::double precision, 34.7670311::double precision, 'גו המשוררת רחל'::text, NULL::timestamptz, 0, 0),
  -- way/603665979
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9751294::double precision, 34.767425::double precision, 'גן המשוררת רחל - דרום'::text, NULL::timestamptz, 0, 0),
  -- way/607878682
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9809489::double precision, 34.7702441::double precision, 'גן ברגמן'::text, NULL::timestamptz, 0, 0),
  -- way/607878684
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9812424::double precision, 34.7717799::double precision, 'גן בנבנישתי'::text, NULL::timestamptz, 0, 0),
  -- way/608660608
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0698138::double precision, 34.8097791::double precision, 'גן קורצ''אק'::text, NULL::timestamptz, 0, 0),
  -- way/611899373
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0630153::double precision, 34.8214743::double precision, 'גן הבושם'::text, NULL::timestamptz, 0, 0),
  -- way/618681441
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9664727::double precision, 34.8145873::double precision, 'Legend Garden'::text, NULL::timestamptz, 0, 0),
  -- way/620144799
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0831336::double precision, 34.8488606::double precision, 'גינת הרימון'::text, NULL::timestamptz, 0, 0),
  -- way/623856901
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0805397::double precision, 34.7862362::double precision, 'גן זאב'::text, NULL::timestamptz, 0, 0),
  -- way/626824863
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0774158::double precision, 34.8142155::double precision, 'כיכר נח'::text, NULL::timestamptz, 0, 0),
  -- way/629587997
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1625417::double precision, 34.841009::double precision, 'גינה ציבורית'::text, NULL::timestamptz, 0, 0),
  -- way/633879888
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1614275::double precision, 34.850778::double precision, 'גן משחקים אביבי הרצליה'::text, NULL::timestamptz, 0, 0),
  -- way/664340308
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9713968::double precision, 34.7992395::double precision, 'גן גיסין'::text, NULL::timestamptz, 0, 0),
  -- way/664675738
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1373327::double precision, 34.8478674::double precision, 'גן מאיר'::text, NULL::timestamptz, 0, 0),
  -- way/670654760
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9698603::double precision, 34.7996049::double precision, 'גן אמזלג'::text, NULL::timestamptz, 0, 0),
  -- way/674531677
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0681256::double precision, 34.8573078::double precision, 'פארק צמרות'::text, NULL::timestamptz, 0, 0),
  -- way/675318172
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.092969::double precision, 34.8215959::double precision, 'חורשת מבוא הפודים'::text, NULL::timestamptz, 0, 0),
  -- way/676979228
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9739608::double precision, 34.8016823::double precision, 'גן חביב'::text, NULL::timestamptz, 0, 0),
  -- way/676979237
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9733307::double precision, 34.8012028::double precision, 'גן אברמוביץ'::text, NULL::timestamptz, 0, 0),
  -- way/676979238
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9724686::double precision, 34.8045886::double precision, 'גן אילנה'::text, NULL::timestamptz, 0, 0),
  -- way/681794336
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9694588::double precision, 34.8039845::double precision, 'גינה אהרן ושושנה לונדון'::text, NULL::timestamptz, 0, 0),
  -- way/700649416
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1420486::double precision, 34.8418786::double precision, 'גן זהבה טל'::text, NULL::timestamptz, 0, 0),
  -- way/720335280
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0472648::double precision, 34.7528468::double precision, 'גן השניים'::text, NULL::timestamptz, 0, 0),
  -- way/724223420
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9868452::double precision, 34.7784104::double precision, 'גו האלמוגים'::text, NULL::timestamptz, 0, 0),
  -- way/726638115
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9860539::double precision, 34.7853889::double precision, 'גן תדהר'::text, NULL::timestamptz, 0, 0),
  -- way/733464835
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0817833::double precision, 34.7849321::double precision, 'גינת אורי'::text, NULL::timestamptz, 0, 0),
  -- way/753317423
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0548815::double precision, 34.7985312::double precision, 'גן סובוטניק'::text, NULL::timestamptz, 0, 0),
  -- way/757295930
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0768019::double precision, 34.7994223::double precision, 'Butzko Garden'::text, NULL::timestamptz, 0, 0),
  -- way/762309552
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1885244::double precision, 34.8494149::double precision, 'פארק רעננה'::text, NULL::timestamptz, 0, 0),
  -- way/771691389
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1808422::double precision, 34.8551842::double precision, 'גינת יקינטון'::text, NULL::timestamptz, 0, 0),
  -- way/771692042
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1796295::double precision, 34.8593045::double precision, 'גן החרצית'::text, NULL::timestamptz, 0, 0),
  -- way/772361726
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9890987::double precision, 34.7856453::double precision, 'גן הדוגית'::text, NULL::timestamptz, 0, 0),
  -- way/793382691
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0205334::double precision, 34.8138491::double precision, 'גן פופאי'::text, NULL::timestamptz, 0, 0),
  -- way/795805511
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1392249::double precision, 34.8364757::double precision, 'גן בלהה'::text, NULL::timestamptz, 0, 0),
  -- way/800705898
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0692032::double precision, 34.8565481::double precision, 'פארק דרום גבעת שמואל'::text, NULL::timestamptz, 0, 0),
  -- way/808776037
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0811507::double precision, 34.8529254::double precision, 'פארק האירועים'::text, NULL::timestamptz, 0, 0),
  -- way/815442802
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1536606::double precision, 34.8384531::double precision, 'גן ציבורי'::text, NULL::timestamptz, 0, 0),
  -- way/828207313
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1712784::double precision, 34.8582447::double precision, 'גן טננבאום'::text, NULL::timestamptz, 0, 0),
  -- way/828436134
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1627176::double precision, 34.8538578::double precision, 'גינת שאולי'::text, NULL::timestamptz, 0, 0),
  -- way/828446192
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1632197::double precision, 34.8594792::double precision, 'גן מעוז'::text, NULL::timestamptz, 0, 0),
  -- way/829224626
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1680619::double precision, 34.8476804::double precision, 'גינת אריה'::text, NULL::timestamptz, 0, 0),
  -- way/829224632
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1718153::double precision, 34.8512157::double precision, 'גן איתן'::text, NULL::timestamptz, 0, 0),
  -- way/829227751
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1645534::double precision, 34.8473786::double precision, 'גינת ישי'::text, NULL::timestamptz, 0, 0),
  -- way/829418358
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1603277::double precision, 34.8477975::double precision, 'גבעת החלומות'::text, NULL::timestamptz, 0, 0),
  -- way/831292988
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1697411::double precision, 34.8348313::double precision, 'גינת עזרא הסופר'::text, NULL::timestamptz, 0, 0),
  -- way/831356364
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1696211::double precision, 34.8435379::double precision, 'גן גלעד'::text, NULL::timestamptz, 0, 0),
  -- way/832654076
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.163184::double precision, 34.8514383::double precision, 'גינת הבנים'::text, NULL::timestamptz, 0, 0),
  -- way/855004769
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0600824::double precision, 34.7679703::double precision, 'פארק המסילה'::text, NULL::timestamptz, 0, 0),
  -- way/860165461
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1632069::double precision, 34.8538765::double precision, 'גינת גאולה'::text, NULL::timestamptz, 0, 0),
  -- way/861124173
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0080506::double precision, 34.7822142::double precision, 'גן סיפור'::text, NULL::timestamptz, 0, 0),
  -- way/861125061
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0027024::double precision, 34.7684045::double precision, 'גן שמוליקיפוד'::text, NULL::timestamptz, 0, 0),
  -- way/862566143
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0798556::double precision, 34.8230031::double precision, 'גינת הלל'::text, NULL::timestamptz, 0, 0),
  -- way/866987341
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1657652::double precision, 34.8294683::double precision, 'גן זרובבל'::text, NULL::timestamptz, 0, 0),
  -- way/866991977
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.17484::double precision, 34.830247::double precision, 'חצר בית קינן'::text, NULL::timestamptz, 0, 0),
  -- way/867235521
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9484406::double precision, 34.828348::double precision, 'גן רקפות'::text, NULL::timestamptz, 0, 0),
  -- way/867235545
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9471428::double precision, 34.8310757::double precision, 'גן הרקפות'::text, NULL::timestamptz, 0, 0),
  -- way/869721664
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9508863::double precision, 34.8045116::double precision, 'גן האירוס'::text, NULL::timestamptz, 0, 0),
  -- way/877775444
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9685792::double precision, 34.7647439::double precision, 'גן הכימיה'::text, NULL::timestamptz, 0, 0),
  -- way/878093151
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9856861::double precision, 34.7814279::double precision, 'גן דג הזהב'::text, NULL::timestamptz, 0, 0),
  -- way/878093152
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9862342::double precision, 34.7802616::double precision, 'גן הפזית'::text, NULL::timestamptz, 0, 0),
  -- way/880504198
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9867823::double precision, 34.7791194::double precision, 'גן רפסודה'::text, NULL::timestamptz, 0, 0),
  -- way/880516791
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9849377::double precision, 34.7793007::double precision, 'גן מבצע שלמה'::text, NULL::timestamptz, 0, 0),
  -- way/880516798
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.986274::double precision, 34.7795354::double precision, 'גן הסירה'::text, NULL::timestamptz, 0, 0),
  -- way/889247662
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.186092::double precision, 34.8590852::double precision, 'גן עציון'::text, NULL::timestamptz, 0, 0),
  -- way/895849828
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1961007::double precision, 34.8618195::double precision, 'גן משה וילנסקי'::text, NULL::timestamptz, 0, 0),
  -- way/905035014
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9519899::double precision, 34.8250516::double precision, 'גן הנוטרים'::text, NULL::timestamptz, 0, 0),
  -- way/911536075
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0180034::double precision, 34.7782103::double precision, 'גן איה פלוטו'::text, NULL::timestamptz, 0, 0),
  -- way/934157202
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9889825::double precision, 34.7806047::double precision, 'גן הליוויתן'::text, NULL::timestamptz, 0, 0),
  -- way/934157204
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9884164::double precision, 34.781767::double precision, 'גן הדיונות'::text, NULL::timestamptz, 0, 0),
  -- way/935619250
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0716277::double precision, 34.821708::double precision, 'Tzadok Park'::text, NULL::timestamptz, 0, 0),
  -- way/935620950
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0685529::double precision, 34.8207922::double precision, 'HaShikhrur Boulevard'::text, NULL::timestamptz, 0, 0),
  -- way/935624055
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0721365::double precision, 34.8261857::double precision, 'HaShoshan Park'::text, NULL::timestamptz, 0, 0),
  -- way/935625669
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0749359::double precision, 34.8264863::double precision, 'Ha''Agada Park'::text, NULL::timestamptz, 0, 0),
  -- way/935626130
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0777451::double precision, 34.8270067::double precision, 'Sanhedrin Park'::text, NULL::timestamptz, 0, 0),
  -- way/946560744
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0852881::double precision, 34.8498484::double precision, 'פארק המייסדים'::text, NULL::timestamptz, 0, 0),
  -- way/954996065
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0829035::double precision, 34.8534454::double precision, 'גן האתרוג'::text, NULL::timestamptz, 0, 0),
  -- way/957900129
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9534026::double precision, 34.80607::double precision, 'חורשת סמילנסקי'::text, NULL::timestamptz, 0, 0),
  -- way/960839856
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0753067::double precision, 34.8321243::double precision, 'גינת גולומב'::text, NULL::timestamptz, 0, 0),
  -- way/961142112
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1738009::double precision, 34.8561222::double precision, 'גינת שמעון'::text, NULL::timestamptz, 0, 0),
  -- way/961999449
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1687225::double precision, 34.8595135::double precision, 'גינת נח'::text, NULL::timestamptz, 0, 0),
  -- way/963123751
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1312568::double precision, 34.8583017::double precision, 'גינת תדהר'::text, NULL::timestamptz, 0, 0),
  -- way/964386209
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0744586::double precision, 34.8493014::double precision, 'גן גולני'::text, NULL::timestamptz, 0, 0),
  -- way/966017905
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0892239::double precision, 34.8149069::double precision, 'גן מעלה השואבה'::text, NULL::timestamptz, 0, 0),
  -- way/966018443
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0928765::double precision, 34.8180313::double precision, 'גן התותחן'::text, NULL::timestamptz, 0, 0),
  -- way/970592955
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0669862::double precision, 34.8461452::double precision, 'גן שיזף'::text, NULL::timestamptz, 0, 0),
  -- way/970643086
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.174438::double precision, 34.8175912::double precision, 'גבעת מרדכי'::text, NULL::timestamptz, 0, 0),
  -- way/975499323
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.157292::double precision, 34.8499575::double precision, 'גינת רזיאל'::text, NULL::timestamptz, 0, 0),
  -- way/983727145
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1346901::double precision, 34.8350675::double precision, 'גן הנופלים'::text, NULL::timestamptz, 0, 0),
  -- way/998561322
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1760787::double precision, 34.8095609::double precision, 'גינת ורדה מור'::text, NULL::timestamptz, 0, 0),
  -- way/1006402187
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9684987::double precision, 34.7918073::double precision, 'גן המעיין'::text, NULL::timestamptz, 0, 0),
  -- way/1006402196
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9698621::double precision, 34.7941774::double precision, 'גן נדב מלכה'::text, NULL::timestamptz, 0, 0),
  -- way/1014602413
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.077304::double precision, 34.8029758::double precision, 'פטאי'::text, NULL::timestamptz, 0, 0),
  -- way/1019096505
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.175359::double precision, 34.8476627::double precision, 'גינת זאב'::text, NULL::timestamptz, 0, 0),
  -- way/1030963293
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1624982::double precision, 34.8495699::double precision, 'הנרייטה סולד'::text, NULL::timestamptz, 0, 0),
  -- way/1030995249
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1643033::double precision, 34.849678::double precision, 'גינת ענפה'::text, NULL::timestamptz, 0, 0),
  -- way/1033332350
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1640922::double precision, 34.8442321::double precision, 'גינת נצבא'::text, NULL::timestamptz, 0, 0),
  -- way/1038902574
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1531646::double precision, 34.8430673::double precision, 'גינת עפרה חזה'::text, NULL::timestamptz, 0, 0),
  -- way/1039195508
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1797754::double precision, 34.8034756::double precision, 'גינת ברנזון'::text, NULL::timestamptz, 0, 0),
  -- way/1039418427
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.171319::double precision, 34.8338378::double precision, 'גן ציבורי איילת חן'::text, NULL::timestamptz, 0, 0),
  -- way/1042330249
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0769869::double precision, 34.8331065::double precision, 'גן מגדל המים'::text, NULL::timestamptz, 0, 0),
  -- way/1057917986
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1935777::double precision, 34.8543266::double precision, 'גן פרץ'::text, NULL::timestamptz, 0, 0),
  -- way/1057917987
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1956687::double precision, 34.8530291::double precision, 'גן התקומה'::text, NULL::timestamptz, 0, 0),
  -- way/1068993999
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1835687::double precision, 34.854712::double precision, 'גן רום 2000'::text, NULL::timestamptz, 0, 0),
  -- way/1093117900
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9737256::double precision, 34.7828632::double precision, 'גן הציפורן'::text, NULL::timestamptz, 0, 0),
  -- way/1093117908
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.973044::double precision, 34.7826034::double precision, 'גן המרגנית'::text, NULL::timestamptz, 0, 0),
  -- way/1105706331
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9719745::double precision, 34.7616817::double precision, 'גן בולטימור דוד'::text, NULL::timestamptz, 0, 0),
  -- way/1117107389
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9677335::double precision, 34.7697315::double precision, 'גן לנדאו'::text, NULL::timestamptz, 0, 0),
  -- way/1130584170
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9696283::double precision, 34.798474::double precision, 'גן לשם'::text, NULL::timestamptz, 0, 0),
  -- way/1137327466
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0791707::double precision, 34.8523785::double precision, 'גן בוני'::text, NULL::timestamptz, 0, 0),
  -- way/1137332357
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0688376::double precision, 34.8462782::double precision, 'גינת אלונים'::text, NULL::timestamptz, 0, 0),
  -- way/1149072278
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9690119::double precision, 34.7610246::double precision, 'גן משחק העיניים'::text, NULL::timestamptz, 0, 0),
  -- way/1154983592
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9659314::double precision, 34.7669254::double precision, 'גן פרנקו מודליאני'::text, NULL::timestamptz, 0, 0),
  -- way/1182542239
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1024589::double precision, 34.7783081::double precision, 'פארק רידינג'::text, NULL::timestamptz, 0, 0),
  -- way/1185165537
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1012857::double precision, 34.8229882::double precision, 'גינת האצטדיון'::text, NULL::timestamptz, 0, 0),
  -- way/1185165538
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0981591::double precision, 34.8220856::double precision, 'גן האימפולס'::text, NULL::timestamptz, 0, 0),
  -- way/1185165552
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0962137::double precision, 34.8200387::double precision, 'גן היל'::text, NULL::timestamptz, 0, 0),
  -- way/1185165556
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0959141::double precision, 34.8125142::double precision, 'גן תל אביב'::text, NULL::timestamptz, 0, 0),
  -- way/1185369422
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0513971::double precision, 34.7503749::double precision, 'גינת הדולפין'::text, NULL::timestamptz, 0, 0),
  -- way/1188414714
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0415892::double precision, 34.8158808::double precision, 'פארק אריאל שרון'::text, NULL::timestamptz, 0, 0),
  -- way/1196042871
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0273824::double precision, 34.7813479::double precision, 'גינת אביב'::text, NULL::timestamptz, 0, 0),
  -- way/1197962918
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0917145::double precision, 34.8041307::double precision, 'גן החרוזים'::text, NULL::timestamptz, 0, 0),
  -- way/1197962920
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0923723::double precision, 34.8021622::double precision, 'גן ספריית חרוזים'::text, NULL::timestamptz, 0, 0),
  -- way/1213620071
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0192075::double precision, 34.7461337::double precision, 'גן עולי הגרדום'::text, NULL::timestamptz, 0, 0),
  -- way/1220290352
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0607298::double precision, 34.8557033::double precision, 'דרכטן'::text, NULL::timestamptz, 0, 0),
  -- way/1232762017
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1432872::double precision, 34.8000246::double precision, 'פארק המקפצה'::text, NULL::timestamptz, 0, 0),
  -- way/1235939953
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1944952::double precision, 34.8569764::double precision, 'גן אסירי ציון-צפוני'::text, NULL::timestamptz, 0, 0),
  -- way/1235939961
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1938337::double precision, 34.8572175::double precision, 'גן אסירי ציון-דרומי'::text, NULL::timestamptz, 0, 0),
  -- way/1236448633
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1951518::double precision, 34.8522496::double precision, 'גינת חגי'::text, NULL::timestamptz, 0, 0),
  -- way/1237101045
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1957105::double precision, 34.8461342::double precision, 'גן נאות עוזי'::text, NULL::timestamptz, 0, 0),
  -- way/1238170960
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0331991::double precision, 34.7711156::double precision, 'פארק בריכת החורף חולון'::text, NULL::timestamptz, 0, 0),
  -- way/1252398574
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0614831::double precision, 34.8430637::double precision, 'פארק אריאל שרון'::text, NULL::timestamptz, 0, 0),
  -- way/1255759158
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1851667::double precision, 34.8549368::double precision, 'גן גמלא'::text, NULL::timestamptz, 0, 0),
  -- way/1259200987
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0058371::double precision, 34.7360794::double precision, 'פארק תצפית הים'::text, NULL::timestamptz, 0, 0),
  -- way/1263874564
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1637109::double precision, 34.8386513::double precision, 'גן מעונות שרה'::text, NULL::timestamptz, 0, 0),
  -- way/1264498115
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1002833::double precision, 34.7779927::double precision, 'טיילת רידינג'::text, NULL::timestamptz, 0, 0),
  -- way/1310844290
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0586191::double precision, 34.7711992::double precision, 'אלוף בצלות'::text, NULL::timestamptz, 0, 0),
  -- way/1346119108
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9713589::double precision, 34.810474::double precision, 'גן אליעזר בלבן'::text, NULL::timestamptz, 0, 0),
  -- way/1346321847
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9713041::double precision, 34.8156143::double precision, 'גן ראובן ובת שבע'::text, NULL::timestamptz, 0, 0),
  -- way/1347256358
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9699203::double precision, 34.812078::double precision, 'גן מאיר מאיר'::text, NULL::timestamptz, 0, 0),
  -- way/1348698421
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9691109::double precision, 34.81121::double precision, 'גן אלונים'::text, NULL::timestamptz, 0, 0),
  -- way/1391618135
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0283397::double precision, 34.775324::double precision, 'גן אישה'::text, NULL::timestamptz, 0, 0),
  -- way/1391817797
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1313223::double precision, 34.7887417::double precision, 'פארק החוף'::text, NULL::timestamptz, 0, 0),
  -- way/1427677092
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9849892::double precision, 34.7492568::double precision, 'פארק ה-1000'::text, NULL::timestamptz, 0, 0),
  -- way/1443883301
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9675437::double precision, 34.8227036::double precision, 'גן רביבים'::text, NULL::timestamptz, 0, 0),
  -- way/1493423347
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.00004::double precision, 34.7724383::double precision, 'גן ברלב'::text, NULL::timestamptz, 0, 0),
  -- way/1493596217
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9940124::double precision, 34.772949::double precision, 'גן דוד צדוק'::text, NULL::timestamptz, 0, 0),
  -- way/1497051967
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0224132::double precision, 34.8098414::double precision, 'פארק מנחם בגין'::text, NULL::timestamptz, 0, 0),
  -- way/1497056523
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0228816::double precision, 34.8050852::double precision, 'גן ענת'::text, NULL::timestamptz, 0, 0),
  -- way/1551652699
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0744895::double precision, 34.8007127::double precision, 'גן בנימין'::text, NULL::timestamptz, 0, 0),
  -- relation/4865656
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9779623::double precision, 34.7813922::double precision, 'גן הזיכרון'::text, NULL::timestamptz, 0, 0),
  -- relation/5536103
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 31.9808271::double precision, 34.7681522::double precision, 'פארק אקטיבי'::text, NULL::timestamptz, 0, 0),
  -- relation/7773671
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0600977::double precision, 34.8174368::double precision, 'גן כורזין'::text, NULL::timestamptz, 0, 0),
  -- relation/7773806
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0637159::double precision, 34.8127354::double precision, 'גן רבקה'::text, NULL::timestamptz, 0, 0),
  -- relation/8662271
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0799085::double precision, 34.7849345::double precision, 'שדרות דוד המלך'::text, NULL::timestamptz, 0, 0),
  -- relation/11847552
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1980881::double precision, 34.8103062::double precision, 'אקופארק אפולוניה'::text, NULL::timestamptz, 0, 0),
  -- relation/11847553
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1933083::double precision, 34.8074848::double precision, 'גן לאומי אפולוניה - תל ארשף'::text, NULL::timestamptz, 0, 0),
  -- relation/11973327
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1702193::double precision, 34.8268663::double precision, 'ספורטק הרצליה'::text, NULL::timestamptz, 0, 0),
  -- relation/16022802
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1000831::double precision, 34.8105423::double precision, 'גני יהושע'::text, NULL::timestamptz, 0, 0),
  -- relation/16025912
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0540927::double precision, 34.7528479::double precision, 'גן הפסגה'::text, NULL::timestamptz, 0, 0),
  -- relation/16114275
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.0679989::double precision, 34.8474166::double precision, 'גן ויסמונסקי'::text, NULL::timestamptz, 0, 0),
  -- relation/16846976
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.15956::double precision, 34.8212322::double precision, 'פארק גליל ים'::text, NULL::timestamptz, 0, 0),
  -- relation/16864821
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1826328::double precision, 34.8588674::double precision, 'גן הנבל'::text, NULL::timestamptz, 0, 0),
  -- relation/16911289
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'park', 32.1950142::double precision, 34.8593276::double precision, 'גן הנורית'::text, NULL::timestamptz, 0, 0)
) AS v(user_id, type, lat, lng, description, expires_at, confirmations, denials)
WHERE NOT EXISTS (
  SELECT 1 FROM public.markers m
  WHERE m.type = v.type AND m.expires_at IS NULL
    AND abs(m.lat - v.lat) < 0.00045 AND abs(m.lng - v.lng) < 0.00053
);

-- markers type='dog_park' (255 новых после дедупа <50м)
INSERT INTO public.markers (user_id, type, lat, lng, description, expires_at, confirmations, denials)
SELECT v.user_id, v.type, v.lat, v.lng, v.description, v.expires_at, v.confirmations, v.denials
FROM (VALUES
  -- way/94900384
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1211045::double precision, 34.8147652::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/95285933
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0994978::double precision, 34.8030586::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/95286203
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0958824::double precision, 34.7848233::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/95286205
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0970305::double precision, 34.7836345::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/95490309
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1556955::double precision, 34.8445622::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/97197447
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1159066::double precision, 34.7976874::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/97730606
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1299869::double precision, 34.7915654::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/98039775
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1080092::double precision, 34.7944137::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/99692931
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1120003::double precision, 34.81174::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/100599836
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1244623::double precision, 34.7952334::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/100716154
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1186964::double precision, 34.822854::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/100721925
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1138906::double precision, 34.8184931::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/100948747
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1087193::double precision, 34.823208::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/101272635
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1236642::double precision, 34.8293972::double precision, 'Avuka'::text, NULL::timestamptz, 0, 0),
  -- way/101327168
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.110085::double precision, 34.8295569::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/101360183
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1178794::double precision, 34.8285189::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/101362266
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1090601::double precision, 34.8323589::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/101364702
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1150825::double precision, 34.8363972::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/101478084
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1224497::double precision, 34.8417604::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/101494203
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1213527::double precision, 34.8367382::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/104306997
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.061096::double precision, 34.7618709::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/162497666
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9957862::double precision, 34.7680199::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/223588740
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0933213::double precision, 34.8180725::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/224197560
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0926226::double precision, 34.8185786::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/240194282
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0379059::double precision, 34.7594978::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/253911965
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9687855::double precision, 34.8204918::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/253996963
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9632822::double precision, 34.8175561::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/263141707
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1919587::double precision, 34.8489212::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/324588160
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0561936::double precision, 34.7642342::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/368772978
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0747989::double precision, 34.8540285::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/368772979
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0789801::double precision, 34.8478621::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/373930544
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9637699::double precision, 34.775459::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/392254278
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0759828::double precision, 34.7701766::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/392257013
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0727174::double precision, 34.7739598::double precision, 'גן מאיר'::text, NULL::timestamptz, 0, 0),
  -- way/392257014
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0678945::double precision, 34.781873::double precision, 'גן קרית ספר'::text, NULL::timestamptz, 0, 0),
  -- way/395001922
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0792271::double precision, 34.7984927::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/401541209
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9725098::double precision, 34.7857919::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/406576038
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1224021::double precision, 34.8152161::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/437184517
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9803056::double precision, 34.7584656::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/487509795
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0659011::double precision, 34.8314908::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/490154529
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1200238::double precision, 34.7986577::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/500751153
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0573229::double precision, 34.8339019::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/501956617
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0695154::double precision, 34.7727637::double precision, 'גינת כלבים שנקין'::text, NULL::timestamptz, 0, 0),
  -- way/532053039
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0020522::double precision, 34.7334776::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/533732109
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9741382::double precision, 34.7672545::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/537201837
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9556362::double precision, 34.7988242::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/546379309
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9598829::double precision, 34.7873989::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/558213807
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9819974::double precision, 34.770034::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/565487677
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9776071::double precision, 34.779991::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/585219561
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0522632::double precision, 34.8227004::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/585522524
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9962084::double precision, 34.7470652::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/598004087
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9463133::double precision, 34.8205734::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/620144800
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0849107::double precision, 34.8486891::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/624461603
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1840544::double precision, 34.8078049::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/636517200
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.968121::double precision, 34.7806173::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/642846746
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0782811::double precision, 34.7846117::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/645982672
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.128184::double precision, 34.8053435::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/682132671
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9681263::double precision, 34.7600682::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/682210915
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9615547::double precision, 34.7820543::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/693696221
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9869926::double precision, 34.7838471::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/725398264
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1463716::double precision, 34.8470188::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/739880422
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.946979::double precision, 34.8168603::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/762251565
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1189953::double precision, 34.8056138::double precision, 'גינת כלבים'::text, NULL::timestamptz, 0, 0),
  -- way/783354343
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0938511::double precision, 34.777294::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/815728857
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1515636::double precision, 34.8382148::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/847586450
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9682297::double precision, 34.7893922::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/855611082
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1412278::double precision, 34.8467259::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/856725756
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1721385::double precision, 34.8555169::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/866472056
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1592487::double precision, 34.820124::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/935623052
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0688846::double precision, 34.821502::double precision, 'Uz''iel Dog Park'::text, NULL::timestamptz, 0, 0),
  -- way/935626919
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.08065::double precision, 34.8235068::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/935628029
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0713731::double precision, 34.8294201::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/939056764
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.083729::double precision, 34.7837001::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/943903938
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0846344::double precision, 34.7936851::double precision, 'Feivel'::text, NULL::timestamptz, 0, 0),
  -- way/961572096
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0568941::double precision, 34.8448595::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/970581259
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0696391::double precision, 34.8571572::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/981926295
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0695083::double precision, 34.8098737::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/988876839
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9625812::double precision, 34.8035683::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/997348213
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9825832::double precision, 34.779852::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1001825020
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1740714::double precision, 34.835007::double precision, 'גינת כלבים ע"ש גילי שקד-פורז'::text, NULL::timestamptz, 0, 0),
  -- way/1001825025
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.167857::double precision, 34.831853::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1005888573
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9498358::double precision, 34.8048553::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1009993811
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0705068::double precision, 34.8023184::double precision, 'גינת כלבים גלוסקא'::text, NULL::timestamptz, 0, 0),
  -- way/1010248011
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0591858::double precision, 34.8131946::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1010248441
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0672018::double precision, 34.7962048::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1012029409
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1175147::double precision, 34.8412195::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1051151159
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1672277::double precision, 34.821912::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1093597273
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9550256::double precision, 34.8045493::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1122583648
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9713421::double precision, 34.7650848::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1136952045
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0595238::double precision, 34.807284::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1152429290
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1221214::double precision, 34.8036157::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1167727937
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0020935::double precision, 34.7947859::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1183058428
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0956132::double precision, 34.7812385::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1185165562
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0964721::double precision, 34.8148561::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1185369424
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0512487::double precision, 34.7506072::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1191496906
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1674146::double precision, 34.8179711::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1241639031
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.055408::double precision, 34.8574522::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1256321136
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0785313::double precision, 34.8102817::double precision, 'גינת כלבים'::text, NULL::timestamptz, 0, 0),
  -- way/1272165808
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9698624::double precision, 34.7985986::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1274316657
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9329837::double precision, 34.7951298::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1296618647
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0760719::double precision, 34.8129844::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1296618648
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0700505::double precision, 34.8152732::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1301800388
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0724906::double precision, 34.7979003::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1307137937
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1631411::double precision, 34.8513728::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1355328500
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9591585::double precision, 34.8270676::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1374790801
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.112762::double precision, 34.8207527::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1379797079
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0611193::double precision, 34.7715444::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1381590291
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0508157::double precision, 34.7637579::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1389439663
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0500907::double precision, 34.7836006::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1413508185
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.085816::double precision, 34.8138806::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1485570129
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0802448::double precision, 34.8060631::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1485570130
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0811967::double precision, 34.8031028::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1526828572
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1965293::double precision, 34.8528869::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1553474459
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.11886::double precision, 34.7869597::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554187444
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0913987::double precision, 34.7918617::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554187445
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0906477::double precision, 34.7763338::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554218817
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0722632::double precision, 34.7904264::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554218818
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0612588::double precision, 34.7888657::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554218819
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0538248::double precision, 34.8083358::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554218820
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0500976::double precision, 34.8050645::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554218822
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0500306::double precision, 34.7860831::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554218823
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0447622::double precision, 34.7892872::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554218824
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0431696::double precision, 34.8054255::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554218825
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0534708::double precision, 34.7801713::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554218826
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0467179::double precision, 34.7534592::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554218827
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0449592::double precision, 34.7467834::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554218828
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0421424::double precision, 34.7546371::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554218829
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0366337::double precision, 34.7557058::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554218830
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0365351::double precision, 34.7576735::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554218831
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0374867::double precision, 34.7686199::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554218833
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0379291::double precision, 34.7663936::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554218834
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0422621::double precision, 34.7693075::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554218835
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0483736::double precision, 34.7604525::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554218837
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0447741::double precision, 34.771474::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554218838
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0467381::double precision, 34.7732687::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554231807
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0609447::double precision, 34.7783858::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554231808
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1075036::double precision, 34.7901442::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554231809
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1099348::double precision, 34.7852548::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554231810
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.126515::double precision, 34.7998496::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554231811
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1146864::double precision, 34.8396752::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554231812
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1443335::double precision, 34.8002182::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554234346
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0604264::double precision, 34.7817352::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554321069
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0771642::double precision, 34.8027231::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554321070
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0776012::double precision, 34.8051879::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554321071
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0765083::double precision, 34.8105286::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554321072
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.074909::double precision, 34.8179227::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554321073
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0657311::double precision, 34.8120151::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554321074
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0591977::double precision, 34.8170393::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554321075
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0635754::double precision, 34.8072672::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554321076
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0669884::double precision, 34.8038212::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554321077
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0690468::double precision, 34.8058204::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554321078
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0732695::double precision, 34.8034972::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554352601
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0714813::double precision, 34.8217916::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554352602
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0644782::double precision, 34.8366801::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554352603
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0650841::double precision, 34.827176::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554352604
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0608188::double precision, 34.8264266::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554352605
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0432756::double precision, 34.8308094::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554352606
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0611453::double precision, 34.8471337::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554352610
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0577274::double precision, 34.8488423::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554361830
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0815822::double precision, 34.8086898::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554362608
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0863545::double precision, 34.8193934::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554362947
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.091216::double precision, 34.8052245::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554363150
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.086725::double precision, 34.8070591::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554371656
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1820079::double precision, 34.8574061::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1554371657
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1886665::double precision, 34.8553835::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1555184912
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0243556::double precision, 34.8524433::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1555185887
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0658136::double precision, 34.846603::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1555185888
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0660067::double precision, 34.8574229::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1555243873
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0647171::double precision, 34.8501598::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1555333860
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0620018::double precision, 34.8434644::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1555333861
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0608674::double precision, 34.8409414::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1556400051
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1699324::double precision, 34.8475648::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1556400052
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1537933::double precision, 34.8384984::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1556400054
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0068785::double precision, 34.7517834::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1556400055
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0101998::double precision, 34.75607::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1556400056
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0099947::double precision, 34.7598592::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1556400057
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0125591::double precision, 34.7560301::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1556400058
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0190868::double precision, 34.7435991::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1556400059
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0194325::double precision, 34.7570776::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1556400060
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0057058::double precision, 34.7554648::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1556400061
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0119533::double precision, 34.7445966::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1556400062
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0071389::double precision, 34.7429645::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1556400064
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0234494::double precision, 34.7525311::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1556400065
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0265055::double precision, 34.7572042::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1556400066
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0315854::double precision, 34.7576238::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1556400067
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0051464::double precision, 34.7389987::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1556775438
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0384904::double precision, 34.85548::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1557476463
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9374399::double precision, 34.7891442::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1557476466
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9332096::double precision, 34.8001405::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1557881486
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0245933::double precision, 34.8068456::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558093028
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9408957::double precision, 34.8447817::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558093029
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9403566::double precision, 34.8293784::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558093030
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9356026::double precision, 34.8250465::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558093031
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9337863::double precision, 34.8325066::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558093034
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9315081::double precision, 34.8328326::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558093035
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9392036::double precision, 34.8318167::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558093036
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9467172::double precision, 34.8316973::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558093037
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9557953::double precision, 34.8150036::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558093038
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9445731::double precision, 34.8318692::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558093039
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9534911::double precision, 34.8450867::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558093040
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9720764::double precision, 34.8130062::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558093041
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9793537::double precision, 34.8031127::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558093044
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0029899::double precision, 34.78724::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558093045
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0078661::double precision, 34.7805051::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558093046
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0003227::double precision, 34.7642156::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558093047
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0010432::double precision, 34.8356659::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558093048
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9890858::double precision, 34.7898323::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558103286
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0048035::double precision, 34.7610703::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558103287
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0119448::double precision, 34.7835984::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558103290
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0125139::double precision, 34.7706186::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558103293
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0266308::double precision, 34.7760673::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558103294
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0343396::double precision, 34.7677678::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558103295
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0191724::double precision, 34.7945982::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558103296
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 31.9928279::double precision, 34.7750487::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558108058
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1170222::double precision, 34.7927332::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558108936
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1146182::double precision, 34.8156704::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558109400
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1181736::double precision, 34.8124153::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558110090
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1097183::double precision, 34.8164544::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558111152
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0977465::double precision, 34.8014484::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558111960
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0864222::double precision, 34.7960209::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558113429
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0819172::double precision, 34.7795505::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558113821
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0671235::double precision, 34.7648958::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558115012
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0508242::double precision, 34.7741348::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558118665
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0439256::double precision, 34.7781096::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558119802
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0690028::double precision, 34.8011195::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558121725
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0818565::double precision, 34.7949821::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558122143
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0615218::double precision, 34.7749055::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558498290
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0484759::double precision, 34.8389801::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- way/1558498291
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0606788::double precision, 34.8195598::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/2394469951
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0408616::double precision, 34.7806555::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/4286227494
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0904958::double precision, 34.77183::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/4597535431
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0307806::double precision, 34.7737794::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/6760840686
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0576248::double precision, 34.7780926::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/6988910502
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1395334::double precision, 34.8394071::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/7443421287
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1397669::double precision, 34.8342025::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/7581306371
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1492939::double precision, 34.8427896::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/9095315603
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1345196::double precision, 34.8348835::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/9424821518
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1444705::double precision, 34.8365555::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/11110429474
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0123377::double precision, 34.7816887::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/12087543674
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1246438::double precision, 34.8221124::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/14139665598
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0826392::double precision, 34.7862206::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/14139690401
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0885486::double precision, 34.7879195::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/14139885053
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0879949::double precision, 34.770243::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/14139885057
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0645291::double precision, 34.7994832::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/14139885073
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0596018::double precision, 34.7972597::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/14139885096
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0526784::double precision, 34.7940682::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/14139933315
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0493658::double precision, 34.7543715::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/14139933345
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0366539::double precision, 34.7526996::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/14139933346
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0316251::double precision, 34.7489997::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/14140022623
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.1267894::double precision, 34.8281711::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/14141034674
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0630359::double precision, 34.8238448::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/14141103971
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0817416::double precision, 34.8124564::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/14141103972
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0896829::double precision, 34.8106785::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/14141103973
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0852017::double precision, 34.8204549::double precision, NULL::text, NULL::timestamptz, 0, 0),
  -- node/14141103974
  ('e57637d6-7b83-465c-8263-6ca0fa822ab4'::uuid, 'dog_park', 32.0774467::double precision, 34.8220196::double precision, NULL::text, NULL::timestamptz, 0, 0)
) AS v(user_id, type, lat, lng, description, expires_at, confirmations, denials)
WHERE NOT EXISTS (
  SELECT 1 FROM public.markers m
  WHERE m.type = v.type AND m.expires_at IS NULL
    AND abs(m.lat - v.lat) < 0.00045 AND abs(m.lng - v.lng) < 0.00053
);

COMMIT;
