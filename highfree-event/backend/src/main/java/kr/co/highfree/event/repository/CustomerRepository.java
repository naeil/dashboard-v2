package kr.co.highfree.event.repository;

import kr.co.highfree.event.domain.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
    public interface CustomerRepository extends JpaRepository<Customer, Long> {
            Optional<Customer> findByPhoneNumber(String phoneNumber);

    @Query(value = "SELECT c.id, c.phone_number, pt.points, pt.description, c.marketing_agree, c.created_at FROM customers c LEFT JOIN point_transactions pt ON c.id = pt.customer_id AND pt.tx_type = 'EARN' ORDER BY c.created_at DESC", nativeQuery = true)
            List<Object[]> findAllParticipants();
    }
