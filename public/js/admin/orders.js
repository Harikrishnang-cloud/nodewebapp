// Handle order status updates
document.querySelectorAll('.order-status').forEach(select => {
    select.addEventListener('change', async function() {
        const orderId = this.dataset.orderId;
        const status = this.value;

        try {
            const response = await fetch('/admin/update-order-status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ orderId, status })
            });

            const data = await response.json();

            if (data.success) {
                // Show success message
                Swal.fire({
                    icon: 'success',
                    title: 'Success!',
                    text: 'Order status updated successfully',
                    timer: 2000,
                    showConfirmButton: false
                });

                // If order is delivered or cancelled, disable the select
                if (status === 'Delivered' || status === 'Cancelled') {
                    this.disabled = true;
                }
            } else {
                // Show error message and reset select
                Swal.fire({
                    icon: 'error',
                    title: 'Error!',
                    text: data.message || 'Failed to update order status'
                });
                this.value = this.dataset.originalStatus;
            }
        } catch (error) {
            console.error('Error updating order status:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error!',
                text: 'Failed to update order status'
            });
            this.value = this.dataset.originalStatus;
        }
    });

    // Store original status for reverting on error
    select.dataset.originalStatus = select.value;
});

// Handle view order details
function viewOrderDetails(orderId) {
    window.location.href = `/admin/order-details/${orderId}`;
}

// Handle order cancellation
async function cancelOrder(orderId) {
    const result = await Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, cancel it!'
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`/admin/orderspage/${orderId}/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                Swal.fire(
                    'Cancelled!',
                    'Order has been cancelled.',
                    'success'
                ).then(() => {
                    // Reload page to reflect changes
                    window.location.reload();
                });
            } else {
                Swal.fire(
                    'Error!',
                    data.message || 'Failed to cancel order',
                    'error'
                );
            }
        } catch (error) {
            console.error('Error cancelling order:', error);
            Swal.fire(
                'Error!',
                'Failed to cancel order',
                'error'
            );
        }
    }
}
