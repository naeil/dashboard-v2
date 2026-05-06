package naeil.dashboard.repository;

import naeil.dashboard.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, Long> {
    Optional<Customer> findByCompanyIdAndCustomerHtel(Long companyId, String customerHtel);

    long countByCompanyId(Long companyId);
}
