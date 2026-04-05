import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/PageHeader/PageHeader";
import BackButton from "../../../components/BackButton/BackButton";
import HeaderButton from "../../../components/HeaderButton/HeaderButton";
import styles from "./UserRequestHistoryPage.module.css";

const UserRequestHistoryPage = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <PageHeader
        title="자산 요청 내역"
        desc={<BackButton label="내 자산 관리" to="/user/my-assets" />}
        actions={
          <>
            <HeaderButton
              label="등록 요청"
              onClick={() => navigate("/user/my-assets/request")}
            />
            <HeaderButton active
              label="요청 내역"
              onClick={() => navigate("/user/my-assets/history")}
            />
          </>
        }
      />
    </div>
  );
};

export default UserRequestHistoryPage;
